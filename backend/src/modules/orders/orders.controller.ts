import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { UserRole, EvidenceType } from '@/common/enums';
import {
  DispatchRouteDto,
  AssignDriverDto,
  UpdateLocationDto,
  SubmitCsatDto,
  OrderFilterDto,
} from './dto';

/**
 * Orders Controller
 * Permisos según MD050 - Matriz de Roles y Seguridad
 */
@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // =============================================
  // ENDPOINTS PÚBLICOS (Sin autenticación)
  // =============================================

  /**
   * Public tracking endpoint (Cliente Final)
   * Usa token hash para seguridad - NO expone IDs secuenciales
   */
  @Get('track/:hash')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Public order tracking by hash' })
  @ApiParam({ name: 'hash', description: 'Tracking hash (token seguro)' })
  async trackOrder(@Param('hash') hash: string) {
    const order = await this.ordersService.findByTrackingHash(hash);
    if (!order) {
      return { error: 'Pedido no encontrado o enlace expirado' };
    }
    return order;
  }

  /**
   * Submit CSAT score (Cliente Final)
   * RF-05: Encuesta de Satisfacción
   */
  @Post('track/:hash/csat')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit customer satisfaction score' })
  submitCsat(@Param('hash') hash: string, @Body() dto: SubmitCsatDto) {
    return this.ordersService.submitCsatScore(hash, dto);
  }

  // =============================================
  // ENDPOINTS MULTI-ROL (Lectura según permisos)
  // =============================================

  /**
   * Get all orders with filters
   * - PURCHASING: Ve pedidos para validar/liberar
   * - ADMIN: Ve todos para planificar rutas
   * - SALES: Ve pedidos (solo lectura, vista "Mis Pedidos")
   * - DIRECTOR: Ve todos (solo lectura, dashboard)
   * - DRIVER: NO tiene acceso (usa /my-route)
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PURCHASING, UserRole.ADMIN, UserRole.SALES, UserRole.DIRECTOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get orders (filtered by role permissions)' })
  findAll(@Query() filters: OrderFilterDto, @CurrentUser() user: any) {
    // SALES solo ve pedidos relacionados a sus clientes (implementar filtro)
    return this.ordersService.findAll(filters);
  }

  /**
   * Get single order details
   * - Todos los roles autenticados pueden ver detalles
   * - DRIVER: Solo puede ver órdenes asignadas a él
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get order by ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.findOne(id, user);
  }

  /**
   * Get dashboard statistics
   * - ADMIN: KPIs operativos
   * - DIRECTOR: Dashboard global (solo lectura)
   */
  @Get('stats/dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get dashboard statistics' })
  getDashboardStats() {
    return this.ordersService.getDashboardStats();
  }

  // =============================================
  // ENDPOINTS ROL: PURCHASING (Analista de Compras)
  // Permisos: Sincronizar, Validar existencia, Liberar pedidos
  // =============================================

  /**
   * Release orders to Traffic (cambiar DRAFT -> READY)
   * RF-01: Liberar pedidos a Tráfico después de validar existencia física
   */
  @Post('release')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PURCHASING)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Release validated orders to Traffic department' })
  releaseOrders(@Body() body: { orderIds: string[] }) {
    return this.ordersService.releaseToTraffic(body.orderIds);
  }

  /**
   * Revert orders from Traffic back to Purchasing (READY -> DRAFT)
   * Permite revertir pedidos liberados por error
   */
  @Post('revert')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PURCHASING, UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revert orders from Traffic back to Purchasing' })
  revertOrders(@Body() body: { orderIds: string[] }) {
    return this.ordersService.revertToDraft(body.orderIds);
  }

  // =============================================
  // ENDPOINTS ROL: ADMIN (Jefe de Tráfico)
  // Permisos: Mapa, Asignar Choferes, Despachar, Gestión
  // Restricciones: NO sincroniza, NO edita montos
  // =============================================

  /**
   * Assign driver to orders
   * RF-03: Asignación de Recursos y Gestión de Flota
   */
  @Post('assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assign driver to orders' })
  assignDriver(@Body() dto: AssignDriverDto) {
    return this.ordersService.assignDriver(dto);
  }

  /**
   * Dispatch route and trigger ETA notifications
   * RF-12 / CU-06: Despacho de Ruta y Alerta Masiva
   */
  @Post('dispatch')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dispatch route and send ETA notifications' })
  dispatchRoute(@Body() dto: DispatchRouteDto) {
    return this.ordersService.dispatchRoute(dto);
  }

  /**
   * Update order location (manual pin correction)
   * RF-03: Resiliencia Geográfica - Corrección manual del pin
   */
  @Patch('location')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually correct order location on map' })
  updateLocation(@Body() dto: UpdateLocationDto) {
    return this.ordersService.updateLocation(dto);
  }

  // =============================================
  // ENDPOINTS ROL: DRIVER (Chofer Operativo)
  // Permisos: Solo SU ruta, botones acción, captura POD
  // Restricciones: NO ve montos, NO ve rutas de otros
  // =============================================

  /**
   * Get driver's current route
   * Solo ve pedidos asignados a él
   */
  @Get('my-route')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DRIVER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current driver assigned route' })
  getMyRoute(@CurrentUser('id') driverId: string) {
    return this.ordersService.getDriverRoute(driverId);
  }

  /**
   * Mark order as delivered with evidence
   * RF-04: Prueba de Entrega (POD)
   */
  @Patch(':id/deliver')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DRIVER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark order as delivered with evidence (POD)' })
  markAsDelivered(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { type: EvidenceType; storageKey: string; isOffline?: boolean },
    @CurrentUser('id') driverId: string,
  ) {
    return this.ordersService.markAsDelivered(id, body, driverId);
  }

  // =============================================
  // ENDPOINTS ROL: SALES (Ventas/Comercial)
  // Permisos: Consultar (solo lectura), Reseña interna, Ver evidencia
  // Restricciones: SOLO LECTURA operativa
  // =============================================

  /**
   * Add internal note to order
   * RF-09: Portal de Visibilidad - Reseña Interna
   */
  @Patch(':id/note')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SALES, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add internal note to order (for quality reports)' })
  addInternalNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { note: string },
    @CurrentUser() user: any,
  ) {
    return this.ordersService.addInternalNote(id, body.note, user);
  }
}
