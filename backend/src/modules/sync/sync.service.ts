import { Injectable, Logger, ServiceUnavailableException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BindAdapter } from './adapters/bind.adapter';
import { OrdersService } from '../orders/orders.service';
import { ClientsService } from '../clients/clients.service';
import { ClientAddressesService } from '../client-addresses/client-addresses.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly bindAdapter: BindAdapter,
    private readonly ordersService: OrdersService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => ClientsService))
    private readonly clientsService: ClientsService,
    private readonly clientAddressesService: ClientAddressesService,
  ) {}

  /**
   * RF-01: Sincronización Controlada con Bind ERP
   * Ejecuta sincronización manual bajo demanda
   * SYNC DIFERENCIAL: Solo sincroniza pedidos nuevos que no existen en la BD
   */
  async syncFromBind(): Promise<{
    success: boolean;
    created: number;
    updated: number;
    errors: Array<{ bindId: string; error: string }>;
    message: string;
    clients?: { synced: number; addresses: number };
  }> {
    const environment = this.configService.get<string>('environment', 'development');
    const syncEnabled = this.configService.get<boolean>('bind.syncEnabled', false);
    const apiKey = this.configService.get<string>('bind.apiKey', '');

    this.logger.log(`Starting sync in ${environment} environment`);

    // Safety check: sync must be explicitly enabled
    if (!syncEnabled) {
      throw new BadRequestException(
        `Bind sync is disabled in this environment (${environment}). Set BIND_SYNC_ENABLED=true to enable.`,
      );
    }

    // Safety check: API key must not be a placeholder
    const placeholders = ['local_placeholder', 'your_bind_api_key', 'CHANGE_ME', ''];
    if (placeholders.includes(apiKey)) {
      throw new BadRequestException(
        `Bind API key is not configured (current value is a placeholder). Set a real BIND_API_KEY in your environment.`,
      );
    }

    this.logger.log('Starting DIFFERENTIAL sync from Bind ERP...');

    try {
      // Obtener los bind_id de pedidos que ya tenemos en la BD
      const existingBindIds = await this.ordersService.getExistingBindIds();
      this.logger.log(`Found ${existingBindIds.size} existing orders in DB`);

      // Fetch clients FIRST (es rápido y no usa mucha cuota de API)
      this.logger.log('Fetching clients from Bind...');
      const bindClients = await this.bindAdapter.fetchClients();

      // Pausa de 5 segundos para evitar rate limiting después de obtener clientes
      this.logger.log('Waiting 5 seconds to avoid rate limiting...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // LUEGO fetch orders (diferencial - solo los nuevos)
      this.logger.log('Fetching NEW orders from Bind (differential)...');
      const bindOrders = await this.bindAdapter.fetchOrders(existingBindIds);

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
   * Busca un pedido específico por número en Bind y verifica si existe en nuestra BD
   * Útil para diagnóstico cuando un pedido no aparece
   */
  async findOrderDiagnostic(orderNumber: number): Promise<{
    inBind: {
      found: boolean;
      status?: number;
      statusName?: string;
      bindId?: string;
      orderDate?: string;
      clientName?: string;
    };
    inDatabase: {
      found: boolean;
      id?: string;
      status?: string;
      bindId?: string;
    };
    diagnosis: string;
  }> {
    this.logger.log(`Diagnosing order ${orderNumber}...`);

    // Buscar en Bind
    const bindResult = await this.bindAdapter.findOrderByNumber(orderNumber);

    // Buscar en nuestra BD
    const dbOrder = await this.ordersService.findByOrderNumber(orderNumber);

    let diagnosis = '';

    if (!bindResult.found) {
      diagnosis = `El pedido ${orderNumber} NO existe en Bind ERP.`;
    } else if (bindResult.status !== 0) {
      diagnosis = `El pedido ${orderNumber} existe en Bind pero tiene Status=${bindResult.status} (${bindResult.statusName}). Solo sincronizamos Status=0 (Activo - pendientes de entregar).`;
    } else if (dbOrder) {
      diagnosis = `El pedido ${orderNumber} existe en Bind con Status=0 (Activo) y YA está en nuestra BD con status=${dbOrder.status}.`;
    } else {
      diagnosis = `El pedido ${orderNumber} existe en Bind con Status=0 (Activo) pero NO está en nuestra BD. Ejecuta sincronización para traerlo.`;
    }

    return {
      inBind: {
        found: bindResult.found,
        status: bindResult.status,
        statusName: bindResult.statusName,
        bindId: bindResult.bindOrder?.ID,
        orderDate: bindResult.bindOrder?.OrderDate,
        clientName: bindResult.bindOrder?.ClientName,
      },
      inDatabase: {
        found: !!dbOrder,
        id: dbOrder?.id,
        status: dbOrder?.status,
        bindId: dbOrder?.bindId,
      },
      diagnosis,
    };
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
