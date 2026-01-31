import { Controller, Get, Post, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { RoutesService } from './routes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@/common/enums';
import { OptimizeRouteDto, ApplyOptimizationDto } from './dto/optimize-route.dto';

@ApiTags('routes')
@Controller('routes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get('planning')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get orders available for route planning' })
  getOrdersForPlanning() {
    return this.routesService.getOrdersForPlanning();
  }

  @Get('active')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Get all active routes grouped by driver' })
  async getActiveRoutes() {
    const routes = await this.routesService.getActiveRoutes();
    // Convert Map to object for JSON serialization
    const result: Record<string, any[]> = {};
    routes.forEach((orders, driverId) => {
      result[driverId] = orders;
    });
    return result;
  }

  @Get('nearby')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get orders near a location' })
  @ApiQuery({ name: 'lat', required: true, type: Number })
  @ApiQuery({ name: 'lng', required: true, type: Number })
  @ApiQuery({ name: 'radius', required: false, type: Number, description: 'Radius in km' })
  getOrdersNearLocation(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius') radius?: number,
  ) {
    return this.routesService.getOrdersNearLocation(lat, lng, radius);
  }

  @Post('optimize')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Obtener optimizacion de ruta propuesta usando Google Routes API' })
  async optimizeRoute(@Body() dto: OptimizeRouteDto) {
    const result = await this.routesService.optimizeRoute(
      dto.orderIds,
      dto.startTime,
      dto.respectPriority ?? true,
    );

    return {
      success: true,
      ...result,
    };
  }

  @Post('optimize/apply')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Aplicar optimizacion y guardar posiciones de ruta' })
  async applyOptimization(@Body() dto: ApplyOptimizationDto) {
    const result = await this.routesService.applyOptimization(
      dto.optimizedOrderIds,
      dto.startTime,
    );

    return {
      success: true,
      ...result,
    };
  }
}
