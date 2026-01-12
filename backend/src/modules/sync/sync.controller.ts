import { Controller, Post, Get, Delete, Body, Param, UseGuards, HttpCode, HttpStatus, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiBody } from '@nestjs/swagger';

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
  constructor(private readonly syncService: SyncService) {}

  /**
   * RF-01: Sincronización manual con Bind ERP
   */
  @Post('bind')
  @Roles(UserRole.PURCHASING, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync orders from Bind ERP' })
  @ApiResponse({ status: 200, description: 'Sync completed successfully' })
  @ApiResponse({ status: 503, description: 'Bind API unavailable - use Excel fallback' })
  syncFromBind() {
    return this.syncService.syncFromBind();
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
   * Obtiene facturas sin pedido asociado (huérfanas)
   */
  @Get('orphan-invoices')
  @Roles(UserRole.PURCHASING, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get invoices without associated orders' })
  @ApiResponse({ status: 200, description: 'Orphan invoices retrieved' })
  getOrphanInvoices() {
    return this.syncService.getOrphanInvoices();
  }

  /**
   * Descarta una factura (no se requiere pedido)
   */
  @Post('dismiss-invoice')
  @Roles(UserRole.PURCHASING, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dismiss an invoice (mark as not needing an order)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        bindInvoiceId: { type: 'string' },
        invoiceNumber: { type: 'string' },
        clientName: { type: 'string' },
        total: { type: 'number' },
        reason: { type: 'string', nullable: true },
      },
      required: ['bindInvoiceId', 'invoiceNumber', 'clientName', 'total'],
    },
  })
  @ApiResponse({ status: 200, description: 'Invoice dismissed' })
  dismissInvoice(
    @Body() body: {
      bindInvoiceId: string;
      invoiceNumber: string;
      clientName: string;
      total: number;
      reason?: string;
    },
    @Request() req: any,
  ) {
    return this.syncService.dismissInvoice(
      body.bindInvoiceId,
      body.invoiceNumber,
      body.clientName,
      body.total,
      body.reason || null,
      req.user.id,
    );
  }

  /**
   * Obtiene lista de facturas descartadas
   */
  @Get('dismissed-invoices')
  @Roles(UserRole.PURCHASING, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get list of dismissed invoices' })
  @ApiResponse({ status: 200, description: 'Dismissed invoices retrieved' })
  getDismissedInvoices() {
    return this.syncService.getDismissedInvoices();
  }

  /**
   * Restaura una factura descartada
   */
  @Delete('dismissed-invoice/:bindInvoiceId')
  @Roles(UserRole.PURCHASING, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Restore a dismissed invoice' })
  @ApiResponse({ status: 204, description: 'Invoice restored' })
  restoreInvoice(@Param('bindInvoiceId') bindInvoiceId: string) {
    return this.syncService.restoreInvoice(bindInvoiceId);
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
