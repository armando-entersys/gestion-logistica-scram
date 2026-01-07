import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { CreateOrderDto } from '@/modules/orders/dto';

/**
 * Estructura de Pedido según API de Bind ERP (GET /Orders)
 *
 * StatusCode:
 * 0 = Pendiente
 * 1 = Surtido
 * 2 = Cancelado
 */
interface BindOrder {
  ID: string;
  Number: number;
  Serie?: string;
  OrderDate: string;
  ClientID: string;
  ClientName: string;
  RFC?: string;
  PhoneNumber?: string;
  Address?: string;
  Comments?: string;
  WarehouseID?: string;
  WarehouseName?: string;
  EmployeeID?: string;
  EmployeeName?: string;
  PurchaseOrder?: string;
  Total: number;
  StatusCode: number;
  Status?: string;
}

/**
 * Detalle completo de un Pedido (GET /Orders/{id})
 */
interface BindOrderDetail extends BindOrder {
  Products?: Array<{
    ProductID: string;
    Name: string;
    Code: string;
    Qty: number;
    Price: number;
  }>;
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
  Number?: number;
  City?: string;
  State?: string;
}

/**
 * Estructura de Factura según API de Bind ERP (GET /Invoices)
 */
interface BindInvoice {
  ID: string;
  Number: number;
  Serie?: string;
  InvoiceDate: string;
  ClientID: string;
  ClientName: string;
  RFC?: string;
  Total: number;
  Subtotal: number;
  OrderID?: string;
  OrderNumber?: number;
  EmployeeID?: string;
  EmployeeName?: string;
  Status?: string;
}

/**
 * DTO para facturas huérfanas (sin pedido)
 */
export interface OrphanInvoiceDto {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  clientId: string;
  clientName: string;
  employeeName: string;
  total: number;
  hasOrder: boolean;
  orderId?: string;
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
   * Obtiene pedidos pendientes (StatusCode=0) desde /Orders
   */
  async fetchOrders(): Promise<CreateOrderDto[]> {
    this.logger.log('Fetching orders from Bind ERP...');

    if (!this.apiKey || this.apiKey === 'PENDING_BIND_API_KEY') {
      this.logger.warn('Bind API Key not configured');
      throw new Error('Bind API Key not configured. Please set BIND_API_KEY environment variable.');
    }

    try {
      // Obtener pedidos pendientes (Status=0 o sin filtro para obtener todos)
      const response = await firstValueFrom(
        this.httpService.get<BindApiResponse<BindOrder>>(`${this.apiUrl}/api/Orders`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          params: {
            '$orderby': 'OrderDate desc',
            '$top': 100,
          },
        }),
      );

      const bindOrders = response.data.value || [];
      this.logger.log(`Fetched ${bindOrders.length} pending orders from Bind`);

      // Transformar pedidos al formato interno (sin llamadas adicionales para evitar timeout)
      const orders: CreateOrderDto[] = [];

      for (const bindOrder of bindOrders) {
        try {
          // Usar datos directamente de la lista (sin llamadas adicionales)
          const order = this.transformOrder(bindOrder, null);
          orders.push(order);
        } catch (error) {
          this.logger.warn(`Failed to transform order ${bindOrder.ID}: ${error.message}`);
        }
      }

      return orders;
    } catch (error) {
      this.logger.error('Failed to fetch orders from Bind:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Obtiene el detalle completo de un pedido (incluye dirección)
   */
  async getOrderDetail(orderId: string): Promise<BindOrderDetail | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<BindOrderDetail>(`${this.apiUrl}/api/Orders/${orderId}`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.warn(`Failed to fetch order detail ${orderId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Obtiene detalles de un cliente específico
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
   * Transforma un pedido de Bind al formato interno de SCRAM
   */
  private transformOrder(order: BindOrder | BindOrderDetail, client?: BindClient | null): CreateOrderDto {
    // RF-02: Detectar VIP/Urgente en comentarios
    const comments = (order.Comments || '').toUpperCase();
    const isVip = comments.includes('VIP') ||
                  comments.includes('URGENTE') ||
                  comments.includes('PRIORITARIO');

    // Número de pedido visible (ej: PE2945)
    const orderNumber = `${order.Serie || 'PE'}${order.Number}`;

    // Parsear la dirección del pedido
    let addressInfo = this.parseAddress(order.Address || '');

    // Si no hay dirección en el campo Address, buscar en comentarios
    if (!addressInfo.street && order.Comments) {
      const commentsAddress = this.parseAddress(order.Comments);
      // Solo usar la dirección de comentarios si encontramos algo útil
      if (commentsAddress.street || commentsAddress.postalCode || commentsAddress.neighborhood) {
        addressInfo = commentsAddress;
        this.logger.log(`Using address from comments for order ${order.Number}`);
      }
    }

    // Buscar también direcciones en formato específico en comentarios
    // Ej: "Entregar en: Calle X #123, Col. Y, Ciudad Z"
    if (!addressInfo.street && order.Comments) {
      const deliveryMatch = order.Comments.match(/(?:entregar en|enviar a|direcci[oó]n)[:\s]+(.+?)(?:\.|$)/i);
      if (deliveryMatch) {
        const extractedAddress = this.parseAddress(deliveryMatch[1]);
        if (extractedAddress.street) {
          addressInfo = extractedAddress;
          this.logger.log(`Found delivery address in comments for order ${order.Number}`);
        }
      }
    }

    return {
      bindId: order.ID,
      orderNumber,
      warehouseName: order.WarehouseName,
      employeeName: order.EmployeeName,
      clientNumber: client?.Number?.toString(),
      purchaseOrder: order.PurchaseOrder,
      clientName: this.cleanString(order.ClientName),
      clientEmail: client?.Email || '',
      clientPhone: order.PhoneNumber || client?.Telephones,
      clientRfc: order.RFC,
      addressRaw: {
        street: addressInfo.street,
        number: addressInfo.number,
        neighborhood: addressInfo.neighborhood,
        postalCode: addressInfo.postalCode,
        city: addressInfo.city || client?.City || '',
        state: addressInfo.state || client?.State || '',
        reference: order.Comments?.substring(0, 300),
        original: order.Address || '', // Dirección original de Bind sin parsear
      },
      totalAmount: order.Total || 0,
      isVip,
      promisedDate: order.OrderDate ? new Date(order.OrderDate) : undefined,
    };
  }

  /**
   * Parsea una dirección de texto completo a campos estructurados
   * Ejemplo: "ALEJANDRO DUMAS No. 139 Col. Polanco IV Sección, Miguel Hidalgo, Ciudad de México C.P 11550 México"
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

    // Extraer código postal
    const cpMatch = address.match(/C\.?P\.?\s*(\d{5})/i);
    if (cpMatch) {
      result.postalCode = cpMatch[1];
    }

    // Extraer colonia (Col. o Colonia)
    const colMatch = address.match(/Col(?:onia)?\.?\s+([^,]+)/i);
    if (colMatch) {
      result.neighborhood = colMatch[1].trim();
    }

    // Extraer número exterior
    const numMatch = address.match(/(?:No\.?|#|Num\.?)\s*(\d+[A-Z]?)/i);
    if (numMatch) {
      result.number = numMatch[1];
    }

    // La calle es típicamente lo que está antes del número o colonia
    const streetMatch = address.match(/^([^,]+?)(?:\s+(?:No\.?|#|Num\.?)\s*\d|,|\s+Col)/i);
    if (streetMatch) {
      result.street = streetMatch[1].trim();
    }

    // Buscar ciudad en la dirección
    const parts = address.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      // Típicamente: calle, delegación/municipio, ciudad
      const cityPart = parts.find(p =>
        p.includes('Ciudad de México') || p.includes('CDMX') ||
        p.includes('Guadalajara') || p.includes('Monterrey')
      );
      if (cityPart) {
        result.city = cityPart.replace(/C\.?P\.?\s*\d{5}/i, '').replace(/México$/i, '').trim();
      }
    }

    // Si no se pudo parsear la calle, usar la dirección completa
    if (!result.street && address) {
      result.street = address.split(',')[0].trim();
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

  /**
   * Obtiene facturas de Bind ERP
   */
  async fetchInvoices(): Promise<BindInvoice[]> {
    this.logger.log('Fetching invoices from Bind ERP...');

    if (!this.apiKey || this.apiKey === 'PENDING_BIND_API_KEY') {
      this.logger.warn('Bind API Key not configured');
      throw new Error('Bind API Key not configured');
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get<BindApiResponse<BindInvoice>>(`${this.apiUrl}/api/Invoices`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          params: {
            '$top': 100,
          },
        }),
      );

      const invoices = response.data.value || [];
      this.logger.log(`Fetched ${invoices.length} invoices from Bind`);
      return invoices;
    } catch (error) {
      this.logger.error('Failed to fetch invoices from Bind:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Obtiene lista básica de pedidos (sin detalles) para comparación
   * Más ligero que fetchOrders para evitar rate limiting
   */
  async fetchOrdersBasic(): Promise<{ ID: string; OrderID?: string }[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<BindApiResponse<{ ID: string }>>(`${this.apiUrl}/api/Orders`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          params: {
            '$top': 200,
            '$select': 'ID',
          },
        }),
      );
      return response.data.value || [];
    } catch (error) {
      this.logger.warn('Failed to fetch basic orders:', error.message);
      return [];
    }
  }

  /**
   * Identifica facturas huérfanas (sin pedido asociado)
   * @param dismissedIds IDs de facturas que el usuario ha descartado
   */
  async getOrphanInvoices(dismissedIds: string[] = []): Promise<OrphanInvoiceDto[]> {
    this.logger.log('Identifying orphan invoices...');

    try {
      // Solo obtener facturas (las facturas ya tienen OrderID si están vinculadas)
      const invoices = await this.fetchInvoices();

      // Filtrar facturas huérfanas (sin OrderID)
      const orphanInvoices: OrphanInvoiceDto[] = [];

      for (const invoice of invoices) {
        // Si la factura tiene OrderID, no es huérfana
        if (invoice.OrderID) {
          continue;
        }

        // Si ya fue descartada, no mostrar
        if (dismissedIds.includes(invoice.ID)) {
          continue;
        }

        const invoiceNumber = `${invoice.Serie || 'FA'}${invoice.Number}`;

        orphanInvoices.push({
          id: invoice.ID,
          invoiceNumber,
          invoiceDate: invoice.InvoiceDate || '',
          clientId: invoice.ClientID,
          clientName: this.cleanString(invoice.ClientName),
          employeeName: invoice.EmployeeName || 'No asignado',
          total: invoice.Total || 0,
          hasOrder: false,
        });
      }

      this.logger.log(`Found ${orphanInvoices.length} orphan invoices`);
      return orphanInvoices;
    } catch (error) {
      this.logger.error('Failed to get orphan invoices:', error.message);
      throw error;
    }
  }
}
