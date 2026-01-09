import { Injectable, Logger, ServiceUnavailableException, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BindAdapter, OrphanInvoiceDto } from './adapters/bind.adapter';
import { DismissedInvoice } from './entities/dismissed-invoice.entity';
import { OrdersService } from '../orders/orders.service';
import { ClientsService } from '../clients/clients.service';
import { ClientAddressesService } from '../client-addresses/client-addresses.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly timeout: number;

  constructor(
    private readonly bindAdapter: BindAdapter,
    private readonly ordersService: OrdersService,
    private readonly configService: ConfigService,
    @InjectRepository(DismissedInvoice)
    private readonly dismissedInvoiceRepository: Repository<DismissedInvoice>,
    @Inject(forwardRef(() => ClientsService))
    private readonly clientsService: ClientsService,
    private readonly clientAddressesService: ClientAddressesService,
  ) {
    // Timeout de 2 minutos para sincronización completa
    this.timeout = this.configService.get('bind.timeout') || 120000;
  }

  /**
   * RF-01: Sincronización Controlada con Bind ERP
   * Ejecuta sincronización manual bajo demanda
   */
  async syncFromBind(): Promise<{
    success: boolean;
    created: number;
    updated: number;
    errors: Array<{ bindId: string; error: string }>;
    message: string;
    clients?: { synced: number; addresses: number };
  }> {
    this.logger.log('Starting manual sync from Bind ERP...');

    try {
      // Fetch orders and clients from Bind in parallel
      const [bindOrders, bindClients] = await Promise.race([
        Promise.all([
          this.bindAdapter.fetchOrders(),
          this.bindAdapter.fetchClients(),
        ]),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Bind API timeout')), this.timeout),
        ),
      ]);

      // Sync clients with their addresses first
      let clientResult = { synced: 0, addresses: 0 };
      // Create a map of Bind ClientID -> ClientNumber for order mapping
      const clientIdToNumberMap = new Map<string, string>();
      if (bindClients && bindClients.length > 0) {
        this.logger.log(`Syncing ${bindClients.length} clients with addresses...`);
        clientResult = await this.clientsService.syncClients(bindClients);
        // Build the lookup map
        for (const client of bindClients) {
          clientIdToNumberMap.set(client.bindId, client.clientNumber);
        }
        this.logger.log(`Built client ID to number map with ${clientIdToNumberMap.size} entries`);
      }

      // Sync orders - fix clientNumber using the map if it looks like a UUID
      let orderResult = { created: 0, updated: 0, errors: [] as Array<{ bindId: string; error: string }> };
      if (bindOrders && bindOrders.length > 0) {
        // Fix clientNumber in orders using the map
        let fixedCount = 0;
        const fixedOrders = bindOrders.map(order => {
          // Check if clientNumber looks like a UUID (has dashes and 36 chars)
          if (order.clientNumber && order.clientNumber.includes('-') && order.clientNumber.length === 36) {
            const correctNumber = clientIdToNumberMap.get(order.clientNumber);
            if (correctNumber) {
              fixedCount++;
              this.logger.log(`Fixed clientNumber for order ${order.bindId}: ${order.clientNumber} -> ${correctNumber}`);
              return { ...order, clientNumber: correctNumber };
            } else {
              this.logger.warn(`Could not find client number for Bind ID: ${order.clientNumber}`);
            }
          }
          return order;
        });
        this.logger.log(`Fixed ${fixedCount} order clientNumbers from UUID to real number`);
        orderResult = await this.ordersService.syncWithBind(fixedOrders);
      }

      return {
        success: true,
        ...orderResult,
        clients: clientResult,
        message: `Sync completed: ${orderResult.created} orders created, ${orderResult.updated} updated, ${clientResult.synced} clients synced with ${clientResult.addresses} addresses`,
      };
    } catch (error) {
      this.logger.error('Sync failed:', error);

      // RF-01: Si la API falla, indicar modo de contingencia
      throw new ServiceUnavailableException({
        message: 'Bind API is unavailable. Please use manual Excel upload as contingency.',
        error: error instanceof Error ? error.message : 'Unknown error',
        fallbackEnabled: true,
      });
    }
  }

  /**
   * RF-01: Carga manual por Excel (contingencia)
   */
  async syncFromExcel(orders: any[]): Promise<{
    success: boolean;
    created: number;
    updated: number;
    errors: Array<{ bindId: string; error: string }>;
  }> {
    this.logger.log(`Processing ${orders.length} orders from Excel upload...`);

    // Transform Excel data to CreateOrderDto format
    const transformedOrders = orders.map((row) => ({
      bindId: row.bind_id || row.ID || `EXCEL-${Date.now()}`,
      clientName: row.client_name || row.ClientName || '',
      clientEmail: row.client_email || row.ClientEmail || '',
      clientPhone: row.client_phone || row.ClientPhone,
      clientRfc: row.client_rfc || row.ClientRFC,
      addressRaw: {
        street: row.street || row.Street || '',
        number: row.number || row.Number || '',
        neighborhood: row.neighborhood || row.Neighborhood || '',
        postalCode: row.postal_code || row.PostalCode || '',
        city: row.city || row.City || '',
        state: row.state || row.State || '',
        reference: row.reference || row.Reference,
      },
      totalAmount: parseFloat(row.total_amount || row.TotalAmount || 0),
      isVip: row.is_vip === true || row.is_vip === 'true',
      promisedDate: row.promised_date ? new Date(row.promised_date) : undefined,
    }));

    const result = await this.ordersService.syncWithBind(transformedOrders);
    return {
      success: true,
      ...result,
    };
  }

  /**
   * Obtiene facturas sin pedido asociado (huérfanas)
   */
  async getOrphanInvoices(): Promise<OrphanInvoiceDto[]> {
    this.logger.log('Getting orphan invoices...');

    try {
      // Obtener IDs de facturas descartadas
      const dismissedInvoices = await this.dismissedInvoiceRepository.find({
        select: ['bindInvoiceId'],
      });
      const dismissedIds = dismissedInvoices.map(d => d.bindInvoiceId);

      // Obtener facturas huérfanas de Bind
      const orphanInvoices = await this.bindAdapter.getOrphanInvoices(dismissedIds);

      return orphanInvoices;
    } catch (error) {
      this.logger.error('Failed to get orphan invoices:', error);
      throw new ServiceUnavailableException({
        message: 'Failed to fetch orphan invoices from Bind',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Descarta una factura (no la mostrará más)
   */
  async dismissInvoice(
    bindInvoiceId: string,
    invoiceNumber: string,
    clientName: string,
    total: number,
    reason: string | null,
    dismissedById: string,
  ): Promise<DismissedInvoice> {
    this.logger.log(`Dismissing invoice ${bindInvoiceId}...`);

    // Verificar si ya existe
    const existing = await this.dismissedInvoiceRepository.findOne({
      where: { bindInvoiceId },
    });

    if (existing) {
      return existing;
    }

    const dismissedInvoice = this.dismissedInvoiceRepository.create({
      bindInvoiceId,
      invoiceNumber,
      clientName,
      total,
      reason,
      dismissedById,
    });

    return this.dismissedInvoiceRepository.save(dismissedInvoice);
  }

  /**
   * Obtiene lista de facturas descartadas
   */
  async getDismissedInvoices(): Promise<DismissedInvoice[]> {
    return this.dismissedInvoiceRepository.find({
      relations: ['dismissedBy'],
      order: { dismissedAt: 'DESC' },
    });
  }

  /**
   * Restaura una factura descartada (vuelve a mostrarla)
   */
  async restoreInvoice(bindInvoiceId: string): Promise<void> {
    await this.dismissedInvoiceRepository.delete({ bindInvoiceId });
  }

  /**
   * Sincroniza direcciones de un cliente desde Bind ERP
   * - Obtiene direcciones del cliente desde Bind usando el clientBindId (UUID)
   * - Las guarda en nuestra BD usando clientNumber
   * - No duplica direcciones que ya existen (comparación por texto normalizado)
   * - Retorna las direcciones actualizadas del cliente
   */
  async syncClientAddresses(
    clientBindId: string,
    clientNumber: string,
  ): Promise<{
    success: boolean;
    synced: number;
    total: number;
    message: string;
  }> {
    this.logger.log(`Syncing addresses for client ${clientNumber} (Bind ID: ${clientBindId})...`);

    try {
      // Obtener direcciones desde Bind
      const bindAddresses = await this.bindAdapter.getClientAddresses(clientBindId);

      if (!bindAddresses || bindAddresses.length === 0) {
        this.logger.log(`No addresses found in Bind for client ${clientNumber}`);
        return {
          success: true,
          synced: 0,
          total: 0,
          message: 'No se encontraron direcciones en Bind para este cliente',
        };
      }

      this.logger.log(`Found ${bindAddresses.length} addresses in Bind for client ${clientNumber}`);

      // Sincronizar cada dirección (upsertFromText evita duplicados)
      let syncedCount = 0;
      for (const addressText of bindAddresses) {
        if (addressText && addressText.trim()) {
          const result = await this.clientAddressesService.upsertFromText(
            clientNumber,
            addressText,
            'SYNC',
          );
          if (result) {
            syncedCount++;
          }
        }
      }

      this.logger.log(`Synced ${syncedCount} addresses for client ${clientNumber}`);

      return {
        success: true,
        synced: syncedCount,
        total: bindAddresses.length,
        message: `Sincronizadas ${syncedCount} de ${bindAddresses.length} direcciones`,
      };
    } catch (error) {
      this.logger.error(`Failed to sync addresses for client ${clientNumber}:`, error);
      throw new ServiceUnavailableException({
        message: 'Error al sincronizar direcciones desde Bind',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
