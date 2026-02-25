import { Controller, Post, Get, Delete, Body, Param, UseGuards, HttpCode, HttpStatus, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiBody } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { ConfigService } from '@nestjs/config';

import { SyncService } from './sync.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@/common/enums';

@ApiTags('sync')
@Controller('sync')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SyncController {
  constructor(
    private readonly syncService: SyncService,
    private readonly configService: ConfigService,
    @InjectQueue('sync') private readonly syncQueue: Queue,
  ) {}

  /**
   * RF-01: Sincronización ASÍNCRONA de PEDIDOS con Bind ERP
   * Encola el job y retorna inmediatamente con el jobId
   * El frontend debe hacer polling a /sync/status/:jobId
   * NOTA: Este endpoint solo sincroniza pedidos/facturas, no clientes
   * @param date Fecha de facturas a sincronizar (formato: YYYY-MM-DD). Si no se especifica, usa hoy.
   */
  @Post('bind')
  @Roles(UserRole.PURCHASING, UserRole.ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Start async orders sync from Bind ERP (only orders/invoices)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Fecha de facturas (YYYY-MM-DD)', example: '2026-01-20' },
      },
    },
  })
  @ApiResponse({ status: 202, description: 'Orders sync job queued' })
  async syncFromBind(@Request() req: any, @Body() body?: { date?: string }) {
    const syncDate = body?.date || new Date().toISOString().split('T')[0];

    const job = await this.syncQueue.add(
      'sync-bind',
      { userId: req.user.id, date: syncDate },
      {
        removeOnComplete: { age: 3600 }, // Keep completed jobs for 1 hour
        removeOnFail: { age: 86400 }, // Keep failed jobs for 24 hours
      },
    );

    const environment = this.configService.get<string>('environment', 'development');

    return {
      success: true,
      jobId: job.id,
      date: syncDate,
      environment,
      message: `Sincronización de pedidos del ${syncDate} iniciada en ambiente ${environment}. Consulta el estado en /sync/status/${job.id}`,
    };
  }

  /**
   * Sincronización ASÍNCRONA de CLIENTES con Bind ERP
   * Encola el job y retorna inmediatamente con el jobId
   * El frontend debe hacer polling a /sync/status/:jobId
   */
  @Post('clients')
  @Roles(UserRole.PURCHASING, UserRole.ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Start async clients sync from Bind ERP' })
  @ApiResponse({ status: 202, description: 'Clients sync job queued' })
  async syncClients(@Request() req: any) {
    const job = await this.syncQueue.add(
      'sync-clients',
      { userId: req.user.id },
      {
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86400 },
      },
    );

    return {
      success: true,
      jobId: job.id,
      message: `Sincronización de clientes iniciada. Consulta el estado en /sync/status/${job.id}`,
    };
  }

  /**
   * Consulta el estado de un job de sincronización
   */
  @Get('status/:jobId')
  @Roles(UserRole.PURCHASING, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get sync job status' })
  @ApiResponse({ status: 200, description: 'Job status retrieved' })
  async getSyncStatus(@Param('jobId') jobId: string) {
    const job = await this.syncQueue.getJob(jobId);

    if (!job) {
      return {
        jobId,
        status: 'not_found',
        message: 'Job no encontrado',
      };
    }

    const state = await job.getState();
    const progress = job.progress;

    return {
      jobId,
      status: state,
      progress: typeof progress === 'number' ? progress : 0,
      result: state === 'completed' ? job.returnvalue : null,
      failedReason: state === 'failed' ? job.failedReason : null,
    };
  }

  /**
   * RF-01: Carga manual por Excel (contingencia)
   */
  @Post('excel')
  @Roles(UserRole.PURCHASING, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload orders from Excel (contingency)' })
  @ApiResponse({ status: 200, description: 'Upload completed' })
  syncFromExcel(@Body() body: { orders: any[] }) {
    return this.syncService.syncFromExcel(body.orders);
  }

  /**
   * Sincroniza direcciones de un cliente desde Bind ERP
   * Obtiene las direcciones del catálogo del cliente en Bind y las guarda localmente
   */
  @Post('client-addresses')
  @Roles(UserRole.ADMIN, UserRole.PURCHASING, UserRole.SALES, UserRole.DIRECTOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync client addresses from Bind ERP' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        clientBindId: { type: 'string', description: 'UUID del cliente en Bind (ClientID)' },
        clientNumber: { type: 'string', description: 'Número del cliente para nuestra BD' },
      },
      required: ['clientBindId', 'clientNumber'],
    },
  })
  @ApiResponse({ status: 200, description: 'Addresses synced successfully' })
  @ApiResponse({ status: 503, description: 'Bind API unavailable' })
  syncClientAddresses(
    @Body() body: { clientBindId: string; clientNumber: string },
  ) {
    return this.syncService.syncClientAddresses(body.clientBindId, body.clientNumber);
  }

  /**
   * Diagnóstico: busca un pedido por número en Bind y en la BD local
   * Útil para investigar por qué un pedido no aparece en el sistema
   */
  @Get('diagnose/:orderNumber')
  @Roles(UserRole.ADMIN, UserRole.PURCHASING)
  @ApiOperation({ summary: 'Diagnose why an order is not appearing' })
  @ApiResponse({ status: 200, description: 'Diagnosis completed' })
  diagnoseOrder(@Param('orderNumber') orderNumber: string) {
    return this.syncService.findOrderDiagnostic(parseInt(orderNumber, 10));
  }
}
