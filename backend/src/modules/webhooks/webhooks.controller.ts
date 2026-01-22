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
  ) {}

  /**
   * Endpoint receptor de WebHook Add_Invoice de Bind ERP
   * DESHABILITADO: Solo se sincroniza manualmente desde el botón
   * Se activa automáticamente cuando se crea una nueva factura en Bind
   */
  @Post('bind/invoice')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recibe webhook de nueva factura desde Bind ERP (DESHABILITADO)' })
  @ApiBody({ description: 'Payload de factura de Bind' })
  async handleBindInvoice(@Body() payload: BindInvoiceWebhookPayload) {
    // DESHABILITADO: Solo sincronización manual por ahora
    this.logger.log(`[WebHook] IGNORADO - Recibida factura de Bind: ${payload.Serie || 'FA'}${payload.Number}`);
    return {
      success: true,
      message: 'Webhook deshabilitado - usar sincronización manual',
      ignored: true,
    };

    /* CÓDIGO ORIGINAL COMENTADO
    this.logger.log(`[WebHook] Recibida factura de Bind: ${payload.Serie || 'FA'}${payload.Number}`);
    this.logger.debug(`[WebHook] Payload: ${JSON.stringify(payload)}`);

    try {
      const result = await this.bindWebhookService.processNewInvoice(payload);

      this.logger.log(`[WebHook] Factura procesada: ${result.message}`);
      return {
        success: true,
        message: result.message,
        orderId: result.orderId,
        carrierType: result.carrierType,
      };
    } catch (error) {
      this.logger.error(`[WebHook] Error procesando factura: ${error.message}`, error.stack);
      // Retornamos 200 para que Bind no reintente, pero indicamos el error
      return {
        success: false,
        error: error.message,
      };
    }
    */
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
