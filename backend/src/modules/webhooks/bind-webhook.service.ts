import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { CarrierType, OrderSource, OrderStatus } from '@/common/enums';
import { BindAdapter } from '../sync/adapters/bind.adapter';
import { OrdersService } from '../orders/orders.service';
import { ClientsService } from '../clients/clients.service';

/**
 * Resultado de procesar una factura
 */
interface ProcessInvoiceResult {
  success: boolean;
  message: string;
  orderId?: string;
  carrierType?: CarrierType;
  skipped?: boolean;
}

/**
 * Detalle completo de una factura de Bind
 */
interface BindInvoiceDetail {
  ID: string;
  Serie?: string;
  Number: number;
  Date: string;
  ClientID: string;
  ClientName: string;
  RFC?: string;
  Total: number;
  Subtotal?: number;
  Comments?: string;
  WarehouseID?: string;
  WarehouseName?: string;
  EmployeeID?: string;
  EmployeeName?: string;
  PurchaseOrder?: string;
  Status?: number;
}

/**
 * Servicio para procesar webhooks de Bind ERP
 * Maneja la lógica de negocio para convertir facturas en órdenes de entrega
 */
@Injectable()
export class BindWebhookService {
  private readonly logger = new Logger(BindWebhookService.name);

  constructor(
    @Inject(forwardRef(() => BindAdapter))
    private readonly bindAdapter: BindAdapter,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    @Inject(forwardRef(() => ClientsService))
    private readonly clientsService: ClientsService,
  ) {}

  /**
   * Procesa una nueva factura recibida desde el webhook de Bind
   * Clasifica el tipo de entrega y crea la orden correspondiente
   */
  async processNewInvoice(invoicePayload: any): Promise<ProcessInvoiceResult> {
    const invoiceNumber = `${invoicePayload.Serie || 'FA'}${invoicePayload.Number}`;
    this.logger.log(`Procesando factura ${invoiceNumber}...`);

    try {
      // 1. Verificar si ya existe una orden para esta factura
      const existingOrder = await this.ordersService.findByBindInvoiceId(invoicePayload.ID);
      if (existingOrder) {
        this.logger.log(`Factura ${invoiceNumber} ya fue procesada (orden: ${existingOrder.id})`);
        return {
          success: true,
          message: `Factura ${invoiceNumber} ya existe en el sistema`,
          orderId: existingOrder.id,
          skipped: true,
        };
      }

      // 2. Obtener detalle completo de la factura (puede tener más info)
      const invoiceDetail = await this.getInvoiceDetail(invoicePayload.ID);
      const invoice = invoiceDetail || invoicePayload;

      // 3. Clasificar el tipo de entrega basado en comentarios
      const deliveryClassification = this.classifyDeliveryType(invoice.Comments || '');

      // 4. Obtener o crear cliente
      const client = await this.findOrCreateClient(invoice);

      // 5. Obtener dirección del cliente desde Bind
      const clientAddresses = await this.bindAdapter.getClientAddresses(invoice.ClientID);
      const primaryAddress = clientAddresses.length > 0 ? clientAddresses[0] : '';

      // 6. Crear la orden de entrega
      const order = await this.ordersService.createFromInvoice({
        bindId: `INV-${invoice.ID}`, // Prefijo para distinguir de pedidos
        bindInvoiceId: invoice.ID,
        invoiceNumber,
        orderSource: OrderSource.BIND_INVOICE,
        carrierType: deliveryClassification.carrierType,
        carrierName: deliveryClassification.providerName,
        clientId: client?.id,
        bindClientId: invoice.ClientID,
        clientName: invoice.ClientName,
        clientEmail: client?.email || '',
        clientPhone: client?.phone || '',
        clientRfc: invoice.RFC || '',
        totalAmount: invoice.Total || 0,
        warehouseName: invoice.WarehouseName,
        employeeName: invoice.EmployeeName,
        purchaseOrder: invoice.PurchaseOrder,
        addressRaw: this.parseAddress(primaryAddress),
        internalNotes: deliveryClassification.notes,
      });

      this.logger.log(
        `Orden creada: ${order.id} | Tipo: ${deliveryClassification.carrierType} | Factura: ${invoiceNumber}`,
      );

      return {
        success: true,
        message: `Orden creada desde factura ${invoiceNumber}`,
        orderId: order.id,
        carrierType: deliveryClassification.carrierType,
      };
    } catch (error) {
      this.logger.error(`Error procesando factura ${invoiceNumber}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clasifica el tipo de entrega basado en los comentarios de la factura
   *
   * Convenciones:
   * - [SCRAM] o sin etiqueta = Entrega con chofer SCRAM
   * - [PROVEEDOR:NombreProveedor] = Entrega directa por proveedor
   * - [PAQUETERIA:Nombre] = Envío por paquetería
   */
  private classifyDeliveryType(comments: string): {
    carrierType: CarrierType;
    providerName?: string;
    notes?: string;
  } {
    const upperComments = (comments || '').toUpperCase();

    // Buscar etiqueta de proveedor: [PROVEEDOR:NombreDeLaEmpresa]
    const providerMatch = comments.match(/\[PROVEEDOR[:\s]*([^\]]+)\]/i);
    if (providerMatch) {
      return {
        carrierType: CarrierType.PROVIDER,
        providerName: providerMatch[1].trim(),
        notes: `Entrega directa por proveedor: ${providerMatch[1].trim()}`,
      };
    }

    // Buscar etiqueta de paquetería
    const carrierMatch = comments.match(/\[PAQUETERIA[:\s]*([^\]]+)\]/i);
    if (carrierMatch) {
      const carrierName = carrierMatch[1].trim().toUpperCase();
      // Mapear a carriers conocidos
      if (carrierName.includes('FEDEX')) return { carrierType: CarrierType.FEDEX };
      if (carrierName.includes('DHL')) return { carrierType: CarrierType.DHL };
      if (carrierName.includes('ESTAFETA')) return { carrierType: CarrierType.ESTAFETA };
      if (carrierName.includes('UPS')) return { carrierType: CarrierType.UPS };
      if (carrierName.includes('REDPACK')) return { carrierType: CarrierType.REDPACK };
      if (carrierName.includes('PAQUETE')) return { carrierType: CarrierType.PAQUETE_EXPRESS };

      return {
        carrierType: CarrierType.OTHER,
        providerName: carrierMatch[1].trim(),
        notes: `Envío por paquetería: ${carrierMatch[1].trim()}`,
      };
    }

    // Si tiene [SCRAM] explícito o no tiene etiqueta = entrega interna
    return {
      carrierType: CarrierType.INTERNAL,
      notes: upperComments.includes('[SCRAM]') ? 'Entrega SCRAM (explícito)' : undefined,
    };
  }

  /**
   * Obtiene el detalle completo de una factura desde Bind
   */
  private async getInvoiceDetail(invoiceId: string): Promise<BindInvoiceDetail | null> {
    try {
      return await this.bindAdapter.getInvoiceDetail(invoiceId);
    } catch (error) {
      this.logger.warn(`No se pudo obtener detalle de factura ${invoiceId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Busca o crea un cliente basado en la información de la factura
   */
  private async findOrCreateClient(invoice: any) {
    try {
      // Buscar por bindClientId
      const existingClient = await this.clientsService.findByBindId(invoice.ClientID);
      if (existingClient) {
        return existingClient;
      }

      // Si no existe, intentar obtener info del cliente desde Bind
      const clientDetails = await this.bindAdapter.getClientDetails(invoice.ClientID);
      if (clientDetails) {
        // Crear el cliente
        return await this.clientsService.createFromBind({
          bindId: invoice.ClientID,
          name: invoice.ClientName,
          email: clientDetails.Email || '',
          phone: clientDetails.Telephones || '',
          rfc: invoice.RFC || '',
          city: clientDetails.City || '',
          state: clientDetails.State || '',
        });
      }

      return null;
    } catch (error) {
      this.logger.warn(`Error buscando/creando cliente: ${error.message}`);
      return null;
    }
  }

  /**
   * Parsea una dirección de texto a objeto estructurado
   */
  private parseAddress(address: string): {
    street: string;
    number: string;
    neighborhood: string;
    postalCode: string;
    city: string;
    state: string;
    reference?: string;
    original?: string;
  } {
    if (!address) {
      return {
        street: '',
        number: '',
        neighborhood: '',
        postalCode: '',
        city: '',
        state: '',
        original: '',
      };
    }

    // Extraer código postal
    const cpMatch = address.match(/C\.?P\.?\s*(\d{5})/i);
    const postalCode = cpMatch ? cpMatch[1] : '';

    // Extraer colonia
    const colMatch = address.match(/Col(?:onia)?\.?\s+([^,]+)/i);
    const neighborhood = colMatch ? colMatch[1].trim() : '';

    // Extraer número
    const numMatch = address.match(/(?:No\.?|#|Num\.?)\s*(\d+[A-Z]?)/i);
    const number = numMatch ? numMatch[1] : '';

    // La calle es típicamente lo que está antes del número o colonia
    const streetMatch = address.match(/^([^,]+?)(?:\s+(?:No\.?|#|Num\.?)\s*\d|,|\s+Col)/i);
    const street = streetMatch ? streetMatch[1].trim() : address.split(',')[0].trim();

    return {
      street,
      number,
      neighborhood,
      postalCode,
      city: '',
      state: '',
      reference: '',
      original: address,
    };
  }
}
