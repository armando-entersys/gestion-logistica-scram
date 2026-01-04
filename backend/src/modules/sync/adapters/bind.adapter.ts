import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { CreateOrderDto } from '@/modules/orders/dto';

/**
 * Estructura de Factura según API de Bind ERP
 * Documentación: https://developers.bind.com.mx/api-details#api=bind-erp-api
 */
interface BindInvoice {
  id: string;
  uuid?: string;
  number: number;
  series?: string;
  client_id: string;
  client_name: string;
  client_phone_number?: string;
  client_contact?: string;
  rfc?: string;
  address?: string;
  fiscal_id?: string;
  status: string;
  status_code: number;
  creation_date: string;
  application_date?: string;
  subtotal: number;
  discount?: number;
  vat?: number;
  ieps?: number;
  total: number;
  comments?: string;
  purchase_order?: string;
  payment_terms?: number;
  payments?: number;
  currency_name?: string;
  exchange_rate?: number;
  location_id?: string;
  location_name?: string;
  warehouse_id?: string;
  warehouse_name?: string;
  products?: BindInvoiceProduct[];
  services?: BindInvoiceService[];
}

interface BindInvoiceProduct {
  id: string;
  sku?: string;
  description: string;
  quantity: number;
  price: number;
  discount?: number;
  total: number;
}

interface BindInvoiceService {
  id: string;
  description: string;
  quantity: number;
  price: number;
  total: number;
}

/**
 * Estructura de Cliente según API de Bind ERP
 */
interface BindClient {
  id: string;
  rfc?: string;
  legal_name: string;
  commercial_name?: string;
  email?: string;
  telephones?: string;
  addresses?: string[];
  credit_days?: number;
  comments?: string;
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
      // Obtener facturas con status Vigente (pendientes de cobro/entrega)
      const response = await firstValueFrom(
        this.httpService.get<BindApiResponse<BindInvoice>>(`${this.apiUrl}/api/Invoices`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          params: {
            // Filtrar por status Vigente (facturas pendientes)
            'filter': "status eq 'Vigente'",
            // Ordenar por fecha de creación descendente
            'orderby': 'creation_date desc',
            // Limitar a últimas 100 facturas
            'top': 100,
          },
        }),
      );

      const invoices = response.data.value || [];
      this.logger.log(`Fetched ${invoices.length} invoices from Bind`);

      // Transformar facturas al formato interno
      const orders: CreateOrderDto[] = [];

      for (const invoice of invoices) {
        try {
          const order = await this.transformInvoice(invoice);
          orders.push(order);
        } catch (error) {
          this.logger.warn(`Failed to transform invoice ${invoice.id}: ${error.message}`);
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
    // Parsear dirección del campo address de la factura
    const addressParts = this.parseAddress(invoice.address || '');

    // RF-02: Detectar VIP/Urgente en comentarios
    const comments = (invoice.comments || '').toUpperCase();
    const isVip = comments.includes('VIP') ||
                  comments.includes('URGENTE') ||
                  comments.includes('PRIORITARIO');

    // Generar ID único basado en número de factura
    const bindId = invoice.uuid || `FAC-${invoice.series || ''}${invoice.number}`;

    return {
      bindId,
      clientName: this.cleanString(invoice.client_name),
      clientEmail: '', // Bind no incluye email en factura, obtener de cliente si es necesario
      clientPhone: invoice.client_phone_number || invoice.client_contact,
      clientRfc: invoice.rfc,
      addressRaw: {
        street: addressParts.street,
        number: addressParts.number,
        neighborhood: addressParts.neighborhood,
        postalCode: addressParts.postalCode,
        city: addressParts.city,
        state: addressParts.state,
        reference: invoice.comments?.substring(0, 200), // Usar comentarios como referencia
      },
      totalAmount: invoice.total || 0,
      isVip,
      promisedDate: invoice.application_date ? new Date(invoice.application_date) : undefined,
    };
  }

  /**
   * Parsea una dirección en texto libre a sus componentes
   * Ejemplo: "Av. Reforma 123, Col. Centro, CP 06600, CDMX"
   */
  private parseAddress(address: string): {
    street: string;
    number: string;
    neighborhood: string;
    postalCode: string;
    city: string;
    state: string;
  } {
    const result = {
      street: '',
      number: '',
      neighborhood: '',
      postalCode: '',
      city: '',
      state: '',
    };

    if (!address) return result;

    // Intentar extraer código postal (5 dígitos)
    const cpMatch = address.match(/(?:CP|C\.P\.?|Código Postal)?\s*(\d{5})/i);
    if (cpMatch) {
      result.postalCode = cpMatch[1];
    }

    // Intentar extraer colonia
    const colMatch = address.match(/(?:Col\.?|Colonia)\s+([^,]+)/i);
    if (colMatch) {
      result.neighborhood = colMatch[1].trim();
    }

    // Intentar extraer número exterior
    const numMatch = address.match(/(?:No\.?|Num\.?|#)?\s*(\d+[-\w]*)/);
    if (numMatch) {
      result.number = numMatch[1];
    }

    // El resto es la calle (primera parte antes de la coma)
    const streetPart = address.split(',')[0] || address;
    result.street = streetPart.replace(/\s*(?:No\.?|Num\.?|#)?\s*\d+[-\w]*\s*$/, '').trim();

    // Buscar ciudad/estado comunes de México
    const cities = ['CDMX', 'Ciudad de México', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'León', 'Juárez', 'Zapopan', 'Mérida'];
    for (const city of cities) {
      if (address.toUpperCase().includes(city.toUpperCase())) {
        result.city = city;
        break;
      }
    }

    // Si no encontró ciudad, usar la última parte después de la última coma
    if (!result.city) {
      const parts = address.split(',');
      if (parts.length > 1) {
        result.city = parts[parts.length - 1].replace(/\d{5}/, '').trim();
      }
    }

    return result;
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
