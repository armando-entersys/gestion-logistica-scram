import {
  Controller,
  Post,
  Body,
  Logger,
  HttpCode,
  HttpStatus,
  Get,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BindWebhookService } from './bind-webhook.service';
import { WebhooksService } from './webhooks.service';

/**
 * Payload que envía Bind cuando se crea una factura
 * Basado en la documentación de Bind ERP WebHooks
 */
interface BindInvoiceWebhookPayload {
  ID: string;
  Serie?: string;
  Number: number;
  Date: string;
  ClientID: string;
  ClientName: string;
  RFC?: string;
  Total: number;
  Comments?: string;
  WarehouseID?: string;
  WarehouseName?: string;
  EmployeeID?: string;
  EmployeeName?: string;
  PurchaseOrder?: string;
}

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly bindWebhookService: BindWebhookService,
    private readonly webhooksService: WebhooksService,
    @InjectQueue('sync') private readonly syncQueue: Queue,
  ) {}

  /**
   * Endpoint receptor de WebHook Add_Invoice de Bind ERP
   * Cuando llega una factura nueva, agrega un job de sync para la fecha de la factura
   * Esto usa la misma lógica de deduplicación que el botón de sincronizar
   */
  @Post('bind/invoice')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recibe webhook de nueva factura desde Bind ERP' })
  @ApiBody({ description: 'Payload de factura de Bind' })
  async handleBindInvoice(@Body() payload: BindInvoiceWebhookPayload) {
    const invoiceNumber = `${payload.Serie || 'FA'}${payload.Number}`;
    this.logger.log(`[WebHook] Recibida factura de Bind: ${invoiceNumber}`);

    try {
      // Extraer la fecha de la factura (formato YYYY-MM-DD)
      const invoiceDate = payload.Date ? payload.Date.split('T')[0] : new Date().toISOString().split('T')[0];

      // Agregar job a la cola de sync con la fecha de la factura
      // Esto sincronizará todas las facturas de ese día usando la misma lógica del botón
      const job = await this.syncQueue.add(
        'sync-bind',
        {
          userId: 'webhook',
          startDate: invoiceDate,
          endDate: invoiceDate,
          source: 'webhook',
          triggeredBy: invoiceNumber,
        },
        {
          removeOnComplete: { age: 3600 },
          removeOnFail: { age: 86400 },
          // Evitar duplicados: si ya hay un job para esta fecha, no agregar otro
          jobId: `webhook-sync-${invoiceDate}`,
        },
      );

      this.logger.log(`[WebHook] Job de sync agregado para fecha ${invoiceDate}, jobId: ${job.id}`);

      return {
        success: true,
        message: `Sincronización programada para ${invoiceDate}`,
        jobId: job.id,
        invoiceNumber,
      };
    } catch (error) {
      // Si el job ya existe (duplicado), es OK
      if (error.message?.includes('Job already exists')) {
        this.logger.log(`[WebHook] Job de sync ya existe para esta fecha, ignorando duplicado`);
        return {
          success: true,
          message: 'Sincronización ya programada',
          invoiceNumber,
        };
      }

      this.logger.error(`[WebHook] Error: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Endpoint para verificar el estado de suscripciones a webhooks de Bind
   */
  @Get('bind/subscriptions')
  @ApiOperation({ summary: 'Lista suscripciones activas a webhooks de Bind' })
  async getBindSubscriptions() {
    return this.webhooksService.getBindSubscriptions();
  }

  /**
   * Endpoint para suscribirse a webhooks de Bind
   */
  @Post('bind/subscribe')
  @ApiOperation({ summary: 'Suscribirse a un webhook de Bind' })
  async subscribeToBindWebhook(
    @Query('webhookId') webhookId: string,
    @Query('targetUrl') targetUrl?: string,
  ) {
    return this.webhooksService.subscribeToBindWebhook(webhookId, targetUrl);
  }

  /**
   * Endpoint de prueba para verificar que el webhook está accesible
   */
  @Get('bind/test')
  @ApiOperation({ summary: 'Verifica que el endpoint de webhook está activo' })
  async testWebhook() {
    return {
      status: 'ok',
      message: 'Webhook endpoint is active and ready to receive Bind notifications',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Endpoint para importar facturas históricas desde Bind
   * Útil para cargar facturas creadas antes de la suscripción al webhook
   *
   * Ejemplo: POST /webhooks/bind/import?startDate=2025-12-01&endDate=2026-01-20
   */
  @Post('bind/import')
  @ApiOperation({ summary: 'Importa facturas históricas desde Bind ERP' })
  async importHistoricalInvoices(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      return {
        success: false,
        error: 'Se requieren parámetros startDate y endDate (formato YYYY-MM-DD)',
      };
    }

    this.logger.log(`[Import] Iniciando importación de facturas desde ${startDate} hasta ${endDate}`);

    try {
      const result = await this.bindWebhookService.importHistoricalInvoices(startDate, endDate);

      this.logger.log(
        `[Import] Completado: ${result.imported} importadas, ${result.skipped} omitidas, ${result.errors} errores`,
      );

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      this.logger.error(`[Import] Error: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
