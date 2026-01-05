import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BindAdapter } from './adapters/bind.adapter';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly timeout: number;

  constructor(
    private readonly bindAdapter: BindAdapter,
    private readonly ordersService: OrdersService,
    private readonly configService: ConfigService,
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
  }> {
    this.logger.log('Starting manual sync from Bind ERP...');

    try {
      // Fetch orders from Bind with timeout
      const bindOrders = await Promise.race([
        this.bindAdapter.fetchOrders(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Bind API timeout')), this.timeout),
        ),
      ]);

      if (!bindOrders || bindOrders.length === 0) {
        return {
          success: true,
          created: 0,
          updated: 0,
          errors: [],
          message: 'No new orders to sync from Bind',
        };
      }

      // Sync to local database using upsert logic
      const result = await this.ordersService.syncWithBind(bindOrders);

      return {
        success: true,
        ...result,
        message: `Sync completed: ${result.created} created, ${result.updated} updated`,
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
}
