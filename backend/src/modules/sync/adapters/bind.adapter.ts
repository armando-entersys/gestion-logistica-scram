import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { CreateOrderDto } from '@/modules/orders/dto';

/**
 * Estructura de Factura según API de Bind ERP (campos en PascalCase)
 * Documentación: https://developers.bind.com.mx/api-details#api=bind-erp-api
 *
 * Status codes:
 * 0 = Vigente (pending/active)
 * 1 = Pagada (paid)
 * 2 = Cancelada (cancelled)
 */
interface BindInvoice {
  ID: string;
  UUID?: string;
  Number: number;
  Serie?: string;
  Date: string;
  ExpirationDate?: string;
  ClientID: string;
  ClientName: string;
  RFC?: string;
  Cost: number;
  Subtotal: number;
  Discount: number;
  VAT: number;
  IEPS: number;
  ISRRet: number;
  VATRet: number;
  Total: number;
  Payments: number;
  CreditNotes: number;
  CurrencyID?: string;
  LocationID?: string;
  WarehouseID?: string;
  PriceListID?: string;
  CFDIUse?: number;
  ExchangeRate: number;
  VATRetRate: number;
  Comments?: string;
  VATRate: number;
  PurchaseOrder?: string;
  IsFiscalInvoice: boolean;
  ShowIEPS: boolean;
  Status: number; // 0=Vigente, 1=Pagada, 2=Cancelada
}

/**
 * Estructura de Cliente según API de Bind ERP
 */
interface BindClient {
  ID: string;
  RFC?: string;
  LegalName: string;
  CommercialName?: string;
  Email?: string;
  Telephones?: string;
  Addresses?: BindClientAddress[];
  CreditDays?: number;
  Comments?: string;
}

interface BindClientAddress {
  ID: string;
  Street?: string;
  ExteriorNumber?: string;
  InteriorNumber?: string;
  Neighborhood?: string;
  City?: string;
  State?: string;
  ZipCode?: string;
  Country?: string;
}

/**
 * Respuesta paginada de la API de Bind
 */
interface BindApiResponse<T> {
  value: T[];
  '@odata.count'?: number;
  '@odata.nextLink'?: string;
}

@Injectable()
export class BindAdapter {
  private readonly logger = new Logger(BindAdapter.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl = this.configService.get('bind.apiUrl') || 'https://api.bind.com.mx';
    this.apiKey = this.configService.get('bind.apiKey') || '';
  }

  /**
   * RF-01: Sincronización Controlada con Bind ERP
   * Obtiene facturas con status "Vigente" (pendientes de entrega)
   *
   * Documentación: https://developers.bind.com.mx/api-details#api=bind-erp-api&operation=Invoices_Get
   */
  async fetchOrders(): Promise<CreateOrderDto[]> {
    this.logger.log('Fetching invoices from Bind ERP...');

    if (!this.apiKey || this.apiKey === 'PENDING_BIND_API_KEY') {
      this.logger.warn('Bind API Key not configured');
      throw new Error('Bind API Key not configured. Please set BIND_API_KEY environment variable.');
    }

    try {
      // Obtener facturas con Status=0 (Vigente/pendientes de cobro/entrega)
      const response = await firstValueFrom(
        this.httpService.get<BindApiResponse<BindInvoice>>(`${this.apiUrl}/api/Invoices`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          params: {
            // Filtrar por Status=0 (Vigente - facturas pendientes)
            '$filter': 'Status eq 0',
            // Ordenar por fecha descendente
            '$orderby': 'Date desc',
            // Limitar a últimas 100 facturas
            '$top': 100,
          },
        }),
      );

      const invoices = response.data.value || [];
      this.logger.log(`Fetched ${invoices.length} pending invoices from Bind`);

      // Transformar facturas al formato interno
      const orders: CreateOrderDto[] = [];

      for (const invoice of invoices) {
        try {
          const order = await this.transformInvoice(invoice);
          orders.push(order);
        } catch (error) {
          this.logger.warn(`Failed to transform invoice ${invoice.ID}: ${error.message}`);
        }
      }

      return orders;
    } catch (error) {
      this.logger.error('Failed to fetch invoices from Bind:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Obtiene detalles de un cliente específico para obtener dirección completa
   */
  async getClientDetails(clientId: string): Promise<BindClient | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<BindClient>(`${this.apiUrl}/api/Clients/${clientId}`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.warn(`Failed to fetch client ${clientId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Transforma una factura de Bind al formato interno de SCRAM
   * Implementa el Anti-Corruption Layer (ACL) del patrón DDD
   */
  private async transformInvoice(invoice: BindInvoice): Promise<CreateOrderDto> {
    // Intentar obtener dirección del cliente
    let addressParts = {
      street: '',
      number: '',
      neighborhood: '',
      postalCode: '',
      city: '',
      state: '',
    };

    // Obtener datos del cliente para dirección y teléfono
    const client = await this.getClientDetails(invoice.ClientID);
    if (client?.Addresses && client.Addresses.length > 0) {
      const addr = client.Addresses[0];
      addressParts = {
        street: addr.Street || '',
        number: addr.ExteriorNumber || '',
        neighborhood: addr.Neighborhood || '',
        postalCode: addr.ZipCode || '',
        city: addr.City || '',
        state: addr.State || '',
      };
    }

    // RF-02: Detectar VIP/Urgente en comentarios
    const comments = (invoice.Comments || '').toUpperCase();
    const isVip = comments.includes('VIP') ||
                  comments.includes('URGENTE') ||
                  comments.includes('PRIORITARIO');

    // Generar ID único basado en UUID o número de factura
    const bindId = invoice.UUID || `FAC-${invoice.Serie || ''}${invoice.Number}`;

    return {
      bindId,
      clientName: this.cleanString(invoice.ClientName),
      clientEmail: client?.Email || '',
      clientPhone: client?.Telephones,
      clientRfc: invoice.RFC,
      addressRaw: {
        street: addressParts.street,
        number: addressParts.number,
        neighborhood: addressParts.neighborhood,
        postalCode: addressParts.postalCode,
        city: addressParts.city,
        state: addressParts.state,
        reference: invoice.Comments?.substring(0, 200),
      },
      totalAmount: invoice.Total || 0,
      isVip,
      promisedDate: invoice.ExpirationDate ? new Date(invoice.ExpirationDate) : undefined,
    };
  }

  private cleanString(str: string): string {
    return (str || '').trim();
  }

  /**
   * Verifica la conectividad con la API de Bind
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.apiUrl}/api/Invoices`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          params: {
            'top': 1,
          },
        }),
      );

      return {
        success: true,
        message: `Connected to Bind ERP successfully. API URL: ${this.apiUrl}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to connect to Bind ERP: ${error.response?.data?.message || error.message}`,
      };
    }
  }
}
