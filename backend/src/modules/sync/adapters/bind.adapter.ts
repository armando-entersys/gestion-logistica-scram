import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { CreateOrderDto } from '@/modules/orders/dto';

/**
 * Estructura de Pedido según API de Bind ERP (GET /Orders)
 *
 * Status (en lista):
 * 1 = Surtido (listo para entregar)
 * 2 = Cancelado
 *
 * StatusCode (en detalle):
 * 0 = Pendiente
 * 1 = Surtido
 * 2 = Cancelado
 */
interface BindOrder {
  ID: string;
  Number: number;
  Serie?: string;
  OrderDate: string; // Fecha prometida de entrega
  ClientID: string;
  ClientName: string;
  RFC?: string;
  PhoneNumber?: string;
  Address?: string; // Solo viene en el detalle del pedido
  Comments?: string;
  WarehouseID?: string;
  WarehouseName?: string;
  EmployeeID?: string;
  EmployeeName?: string;
  PurchaseOrder?: string;
  Total: number;
  StatusCode?: number;
  Status?: number | string; // En lista es número, en detalle es string
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
 * Estructura de Cliente según API de Bind ERP (lista)
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
 * Estructura de Cliente con detalle (GET /Clients/{id})
 * Incluye campo addresses con lista de direcciones en texto
 */
interface BindClientDetails extends BindClient {
  Addresses?: string[];
}

/**
 * DTO para sincronización de clientes
 */
export interface SyncClientDto {
  bindId: string;
  clientNumber: string;
  name: string;
  commercialName?: string;
  email?: string;
  phone?: string;
  rfc?: string;
  city?: string;
  state?: string;
  addresses: string[];
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
   * Obtiene pedidos con Status=1 (Surtido) - listos para entregar
   * Obtiene el detalle de cada pedido para conseguir la dirección de entrega
   * Usa paginación para traer TODOS los pedidos disponibles
   */
  async fetchOrders(): Promise<CreateOrderDto[]> {
    this.logger.log('Fetching ALL orders from Bind ERP (Status=1 Surtido) with pagination...');

    if (!this.apiKey || this.apiKey === 'PENDING_BIND_API_KEY') {
      this.logger.warn('Bind API Key not configured');
      throw new Error('Bind API Key not configured. Please set BIND_API_KEY environment variable.');
    }

    try {
      // Obtener TODOS los pedidos Surtidos (Status=1) con paginación
      const allBindOrders: BindOrder[] = [];
      let skip = 0;
      const pageSize = 100;
      let hasMore = true;

      while (hasMore) {
        const response = await firstValueFrom(
          this.httpService.get<BindApiResponse<BindOrder>>(`${this.apiUrl}/api/Orders`, {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            params: {
              '$filter': 'Status eq 1',
              '$orderby': 'OrderDate desc',
              '$top': pageSize,
              '$skip': skip,
            },
          }),
        );

        const pageOrders = response.data.value || [];
        allBindOrders.push(...pageOrders);

        this.logger.log(`Fetched page ${Math.floor(skip / pageSize) + 1}: ${pageOrders.length} orders (total so far: ${allBindOrders.length})`);

        if (pageOrders.length < pageSize) {
          hasMore = false;
        } else {
          skip += pageSize;
          // Pausa entre páginas para evitar rate limiting
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      const bindOrders = allBindOrders;
      this.logger.log(`Fetched ${bindOrders.length} TOTAL surtido orders from Bind`);

      // Obtener detalles de cada pedido para conseguir la dirección
      const orders: CreateOrderDto[] = [];
      const batchSize = 10; // Procesar en lotes para evitar rate limiting

      for (let i = 0; i < bindOrders.length; i += batchSize) {
        const batch = bindOrders.slice(i, i + batchSize);

        // Obtener detalles en paralelo dentro del lote
        const detailPromises = batch.map(async (bindOrder) => {
          try {
            // Obtener el detalle del pedido para conseguir la dirección
            const detail = await this.getOrderDetail(bindOrder.ID);
            if (detail) {
              return this.transformOrder(detail, null);
            }
            // Si falla el detalle, usar datos de la lista
            return this.transformOrder(bindOrder, null);
          } catch (error) {
            this.logger.warn(`Failed to get detail for order ${bindOrder.ID}: ${error.message}`);
            return this.transformOrder(bindOrder, null);
          }
        });

        const batchResults = await Promise.all(detailPromises);
        orders.push(...batchResults.filter(o => o !== null));

        // Pequeña pausa entre lotes para evitar rate limiting
        if (i + batchSize < bindOrders.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      this.logger.log(`Processed ${orders.length} orders with details`);
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
   * Obtiene detalles de un cliente específico (incluye direcciones)
   */
  async getClientDetails(clientId: string): Promise<BindClientDetails | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<BindClientDetails>(`${this.apiUrl}/api/Clients/${clientId}`, {
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
   * Obtiene las direcciones de un cliente desde Bind ERP
   * @param clientBindId - UUID del cliente en Bind (ClientID)
   * @returns Array de direcciones en texto o vacío si no hay
   */
  async getClientAddresses(clientBindId: string): Promise<string[]> {
    this.logger.log(`Fetching addresses for client ${clientBindId} from Bind...`);

    const clientDetails = await this.getClientDetails(clientBindId);
    if (!clientDetails) {
      this.logger.warn(`Could not get client details for ${clientBindId}`);
      return [];
    }

    const addresses = clientDetails.Addresses || [];
    this.logger.log(`Found ${addresses.length} addresses for client ${clientBindId}`);
    return addresses;
  }

  /**
   * Obtiene todos los clientes de Bind con sus direcciones (con paginación)
   */
  async fetchClients(): Promise<SyncClientDto[]> {
    this.logger.log('Fetching clients from Bind ERP...');

    if (!this.apiKey || this.apiKey === 'PENDING_BIND_API_KEY') {
      this.logger.warn('Bind API Key not configured');
      throw new Error('Bind API Key not configured');
    }

    try {
      // Obtener lista de clientes con paginación (Bind limita a 100 por request)
      const allBindClients: BindClient[] = [];
      let skip = 0;
      const pageSize = 100;
      let hasMore = true;

      while (hasMore) {
        const response = await firstValueFrom(
          this.httpService.get<BindApiResponse<BindClient>>(`${this.apiUrl}/api/Clients`, {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            params: {
              '$top': pageSize,
              '$skip': skip,
            },
          }),
        );

        const pageClients = response.data.value || [];
        allBindClients.push(...pageClients);

        this.logger.log(`Fetched page ${Math.floor(skip / pageSize) + 1}: ${pageClients.length} clients`);

        if (pageClients.length < pageSize) {
          hasMore = false;
        } else {
          skip += pageSize;
          // Pausa entre páginas para evitar rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      this.logger.log(`Fetched ${allBindClients.length} total clients from Bind`);

      // Transformar clientes (sin obtener detalles individuales para evitar rate limiting)
      // Las direcciones se poblarán desde los pedidos sincronizados
      const clients = allBindClients.map(client => this.transformClient(client));

      this.logger.log(`Processed ${clients.length} clients`);
      return clients;
    } catch (error) {
      this.logger.error('Failed to fetch clients from Bind:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Transforma un cliente de Bind al formato interno
   */
  private transformClient(client: BindClient | BindClientDetails): SyncClientDto {
    return {
      bindId: client.ID,
      clientNumber: client.Number?.toString() || client.ID,
      name: this.cleanString(client.LegalName),
      commercialName: client.CommercialName,
      email: client.Email,
      phone: client.Telephones,
      rfc: client.RFC,
      city: client.City,
      state: client.State,
      addresses: (client as BindClientDetails).Addresses || [],
    };
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
      clientNumber: client?.Number?.toString() || order.ClientID,
      bindClientId: order.ClientID, // UUID del cliente en Bind (para sincronizar direcciones)
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
