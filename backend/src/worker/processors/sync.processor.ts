import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { Order } from '@/modules/orders/entities/order.entity';
import { Client } from '@/modules/clients/entities/client.entity';
import { ClientAddress } from '@/modules/client-addresses/entities/client-address.entity';
import { OrderStatus, OrderSource } from '@/common/enums';

interface BindOrderList {
  ID: string;
  Number: number;
  Serie?: string;
  ClientID: string;
  ClientName: string;
  OrderDate: string;
  Comments?: string;
  PhoneNumber?: string;
  RFC?: string;
  Total: number;
  Status: number;
  WarehouseName?: string;
  EmployeeName?: string;
  PurchaseOrder?: string;
}

interface BindOrderDetail extends BindOrderList {
  Address?: string;
}

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

interface SyncJobPayload {
  userId: string;
  date?: string; // Fecha de facturas a sincronizar (YYYY-MM-DD)
}

interface SyncJobResult {
  success: boolean;
  clients: { synced: number };
  orders: { created: number; updated: number; errors: string[] };
  message: string;
}

interface BindInvoice {
  ID: string;
  UUID?: string;
  Series?: string;
  Number: number;
  ClientID: string;
  ClientName: string;
  Date: string;
  Total: number;
  Subtotal?: number;
  Status?: string;
  StatusCode?: number;
  Address?: string;
  Comments?: string;
  RFC?: string;
  ClientPhoneNumber?: string;
  WarehouseName?: string;
  CreatedByName?: string;
  Products?: any[];
  Services?: any[];
}

@Processor('sync')
export class SyncProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncProcessor.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(ClientAddress)
    private readonly clientAddressRepository: Repository<ClientAddress>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    super();
    // Try ConfigService first, then fall back to direct env access
    this.apiUrl = this.configService.get<string>('bind.apiUrl') || process.env.BIND_API_URL || 'https://api.bind.com.mx';
    this.apiKey = this.configService.get<string>('bind.apiKey') || process.env.BIND_API_KEY || '';

    this.logger.log(`SyncProcessor initialized - API URL: ${this.apiUrl}, API Key configured: ${this.apiKey ? 'YES (' + this.apiKey.substring(0, 8) + '...)' : 'NO'}`);
  }

  async process(job: Job<SyncJobPayload>): Promise<SyncJobResult> {
    const syncDate = job.data.date || new Date().toISOString().split('T')[0];
    this.logger.log(`Processing sync job [${job.id}] for date: ${syncDate}`);
    this.logger.log(`Using API URL: ${this.apiUrl}`);
    this.logger.log(`API Key configured: ${this.apiKey ? 'YES' : 'NO'}`);

    // Validate API key before starting
    if (!this.apiKey) {
      const errorMsg = 'BIND_API_KEY not configured. Check worker environment variables.';
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      // Update progress
      await job.updateProgress(5);

      // Step 1: Fetch clients (just the list, no details)
      this.logger.log('Step 1: Fetching clients from Bind...');
      const clients = await this.fetchClients();
      await job.updateProgress(20);

      // Step 2: Sync clients to DB
      this.logger.log(`Step 2: Syncing ${clients.length} clients to DB...`);
      const clientResult = await this.syncClients(clients);
      await job.updateProgress(40);

      // Build client ID -> Number map for orders
      const clientIdToNumberMap = new Map<string, string>();
      for (const client of clients) {
        clientIdToNumberMap.set(client.ID, client.Number?.toString() || client.ID);
      }

      // Pause before fetching invoices
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 3: Get existing order bind_ids
      const existingBindIds = await this.getExistingBindIds();
      await job.updateProgress(45);

      // Step 4: Fetch INVOICES from Bind by date (NEW LOGIC)
      this.logger.log(`Step 3: Fetching invoices from Bind for ${syncDate}...`);
      const invoices = await this.fetchInvoicesByDate(syncDate);
      await job.updateProgress(70);

      // Step 5: Sync invoices as orders to DB
      this.logger.log(`Step 4: Syncing ${invoices.length} invoices as orders to DB...`);
      const orderResult = await this.syncInvoicesAsOrders(invoices, clientIdToNumberMap, existingBindIds);
      await job.updateProgress(100);

      const result: SyncJobResult = {
        success: true,
        clients: { synced: clientResult.synced },
        orders: {
          created: orderResult.created,
          updated: orderResult.updated,
          errors: orderResult.errors,
        },
        message: `Sync completed (${syncDate}): ${orderResult.created} orders created from invoices, ${clientResult.synced} clients synced`,
      };

      this.logger.log(result.message);
      return result;
    } catch (error) {
      this.logger.error(`Sync job failed: ${error.message}`);
      throw error;
    }
  }

  private async fetchClients(): Promise<BindClient[]> {
    const allClients: BindClient[] = [];
    let skip = 0;
    const pageSize = 100;
    let hasMore = true;

    while (hasMore) {
      this.logger.log(`Fetching clients page ${Math.floor(skip / pageSize) + 1}...`);

      try {
        const response = await firstValueFrom(
          this.httpService.get<{ value: BindClient[] }>(`${this.apiUrl}/api/Clients`, {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            params: { '$top': pageSize, '$skip': skip },
          }),
        );

        const pageClients = response.data.value || [];
        allClients.push(...pageClients);

        if (pageClients.length < pageSize) {
          hasMore = false;
        } else {
          skip += pageSize;
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (error: any) {
        this.logger.error(`Error fetching clients from Bind: ${error.message}`);
        if (error.response) {
          this.logger.error(`Response status: ${error.response.status}`);
          this.logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
        }
        throw error;
      }
    }

    this.logger.log(`Fetched ${allClients.length} clients from Bind`);
    return allClients;
  }

  private async syncClients(clients: BindClient[]): Promise<{ synced: number }> {
    let synced = 0;

    for (const client of clients) {
      try {
        const clientNumber = client.Number?.toString() || client.ID;

        await this.clientRepository.upsert(
          {
            clientNumber,
            name: this.cleanString(client.LegalName),
            email: client.Email || null,
            phone: client.Telephones || null,
            rfc: client.RFC || null,
          },
          {
            conflictPaths: ['clientNumber'],
            skipUpdateIfNoValuesChanged: true,
          },
        );
        synced++;
      } catch (error) {
        this.logger.warn(`Failed to sync client ${client.ID}: ${error.message}`);
      }
    }

    return { synced };
  }

  private async getExistingBindIds(): Promise<Set<string>> {
    const result = await this.orderRepository
      .createQueryBuilder('order')
      .select('order.bind_id', 'bindId')
      .where('order.bind_id IS NOT NULL')
      .getRawMany();
    return new Set(result.map(r => r.bindId));
  }

  private async fetchOrders(existingBindIds: Set<string>): Promise<BindOrderDetail[]> {
    const newOrderIds: string[] = [];
    let skip = 0;
    const pageSize = 100;
    let hasMore = true;
    let consecutiveExistingPages = 0;

    // Solo Status=0 (Activo/Pendiente de entregar)
    const filter = 'Status eq 0';

    // Step 1: Get list of new order IDs
    while (hasMore) {
      const response = await firstValueFrom(
        this.httpService.get<{ value: BindOrderList[] }>(`${this.apiUrl}/api/Orders`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          params: {
            '$filter': filter,
            '$top': pageSize,
            '$skip': skip,
            '$orderby': 'OrderDate desc',
          },
        }),
      );

      const pageOrders = response.data.value || [];

      // Filter only new orders
      let newInPage = 0;
      for (const order of pageOrders) {
        if (!existingBindIds.has(order.ID)) {
          newOrderIds.push(order.ID);
          newInPage++;
        }
      }

      this.logger.log(`Page ${Math.floor(skip / pageSize) + 1}: ${pageOrders.length} orders, ${newInPage} new`);

      // Stop if no new orders in 3 consecutive pages
      if (newInPage === 0) {
        consecutiveExistingPages++;
      } else {
        consecutiveExistingPages = 0;
      }

      if (pageOrders.length < pageSize || consecutiveExistingPages >= 3) {
        hasMore = false;
      } else {
        skip += pageSize;
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    this.logger.log(`Found ${newOrderIds.length} new orders, fetching details...`);

    // Step 2: Fetch details for each new order (to get Address)
    const ordersWithDetails: BindOrderDetail[] = [];
    for (let i = 0; i < newOrderIds.length; i++) {
      const orderId = newOrderIds[i];
      try {
        const response = await firstValueFrom(
          this.httpService.get<BindOrderDetail>(`${this.apiUrl}/api/Orders/${orderId}`, {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
          }),
        );
        ordersWithDetails.push(response.data);

        // Log progress every 10 orders
        if ((i + 1) % 10 === 0) {
          this.logger.log(`Fetched details for ${i + 1}/${newOrderIds.length} orders`);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error: any) {
        this.logger.warn(`Failed to fetch order ${orderId}: ${error.message}`);
      }
    }

    this.logger.log(`Fetched ${ordersWithDetails.length} orders with details from Bind`);
    return ordersWithDetails;
  }

  private async syncOrders(
    orders: BindOrderDetail[],
    clientIdToNumberMap: Map<string, string>,
  ): Promise<{ created: number; updated: number; errors: string[] }> {
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const order of orders) {
      try {
        const orderNumber = `${order.Serie || 'PE'}${order.Number}`;

        // Fix clientNumber if it's a UUID
        let clientNumber = order.ClientID;
        if (clientIdToNumberMap.has(order.ClientID)) {
          clientNumber = clientIdToNumberMap.get(order.ClientID)!;
        }

        // Look up client to get the UUID for the relationship
        let clientId: string | null = null;
        const client = await this.clientRepository.findOne({ where: { clientNumber } });
        if (client) {
          clientId = client.id;
        }

        // Parse address - now comes from order detail endpoint
        const rawAddress = order.Address || '';
        const addressInfo = this.parseAddress(rawAddress);

        if (rawAddress) {
          this.logger.log(`Order ${orderNumber} address: ${rawAddress.substring(0, 100)}...`);
        }

        const existing = await this.orderRepository.findOne({
          where: { bindId: order.ID },
        });

        if (existing) {
          await this.orderRepository.update(existing.id, {
            clientName: this.cleanString(order.ClientName),
            totalAmount: order.Total || 0,
          });
          updated++;
        } else {
          // First: Create/get the client address and get its ID
          // IMPORTANT: Store the FULL raw address from Bind without parsing.
          // Bind API (at least in current version) only provides Address as a
          // single text string, not structured fields like ShippingAddress.
          // We store the complete text to avoid data loss (e.g., "Chalco, México").
          let deliveryAddressId: string | null = null;
          if (rawAddress && clientNumber) {
            deliveryAddressId = await this.upsertClientAddress(clientNumber, {
              street: rawAddress, // Full address from Bind - DO NOT parse
              number: '',        // Not available from Bind API
              neighborhood: '',  // Not available from Bind API
              postalCode: addressInfo.postalCode, // Extract CP if found (for filtering)
              city: '',          // Not reliably parseable
              state: '',         // Not reliably parseable
            }, order.ID);
          }

          // Then: Insert the order with the deliveryAddressId
          await this.orderRepository.insert({
            bindId: order.ID,
            orderNumber,
            clientNumber,
            clientId, // UUID from our clients table for the relationship
            deliveryAddressId, // Link to the client's address
            clientName: this.cleanString(order.ClientName),
            clientEmail: '',
            clientPhone: order.PhoneNumber || null,
            clientRfc: order.RFC || null,
            addressRaw: {
              // Use the full address from Bind as-is (no parsing to avoid data loss)
              street: rawAddress,
              number: '',
              neighborhood: '',
              postalCode: '',
              city: '',
              state: '',
              reference: order.Comments?.substring(0, 300),
            },
            totalAmount: order.Total || 0,
            isVip: this.detectVip(order.Comments),
            promisedDate: this.parseBindDate(order.OrderDate),
            status: OrderStatus.DRAFT,
            warehouseName: order.WarehouseName || null,
            employeeName: order.EmployeeName || null,
            purchaseOrder: order.PurchaseOrder || null,
            bindClientId: order.ClientID,
          });
          created++;
        }
      } catch (error) {
        this.logger.warn(`Failed to sync order ${order.ID}: ${error.message}`);
        errors.push(`${order.Serie || 'PE'}${order.Number}: ${error.message}`);
      }
    }

    return { created, updated, errors };
  }

  /**
   * Fetch invoices from Bind by emission date
   */
  private async fetchInvoicesByDate(dateStr: string): Promise<BindInvoice[]> {
    const allInvoices: BindInvoice[] = [];
    let skip = 0;
    const pageSize = 100;
    const maxPages = 30; // Safety limit

    this.logger.log(`Fetching invoices for date: ${dateStr}`);

    for (let page = 0; page < maxPages; page++) {
      try {
        const response = await firstValueFrom(
          this.httpService.get<{ value: BindInvoice[] }>(`${this.apiUrl}/api/Invoices`, {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            params: {
              '$top': pageSize,
              '$skip': skip,
              '$orderby': 'Date desc',
            },
          }),
        );

        const pageInvoices = response.data.value || [];
        if (pageInvoices.length === 0) break;

        // Filter by target date
        for (const inv of pageInvoices) {
          const invDate = inv.Date?.split('T')[0];
          if (invDate === dateStr) {
            allInvoices.push(inv);
          }
        }

        // If we've passed the target date, stop
        const lastInvoiceDate = pageInvoices[pageInvoices.length - 1]?.Date?.split('T')[0];
        if (lastInvoiceDate && lastInvoiceDate < dateStr) {
          this.logger.log(`Reached invoices before ${dateStr}, stopping pagination`);
          break;
        }

        skip += pageSize;
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error: any) {
        this.logger.error(`Error fetching invoices: ${error.message}`);
        throw error;
      }
    }

    this.logger.log(`Found ${allInvoices.length} invoices for ${dateStr}`);

    // Fetch details for each invoice to get Address
    // IMPORTANT: The list endpoint returns 'Date' but the detail endpoint returns 'CreationDate'
    // We need to preserve the Date from the list and merge with detail data
    const invoicesWithDetails: BindInvoice[] = [];
    for (let i = 0; i < allInvoices.length; i++) {
      const inv = allInvoices[i];
      try {
        const response = await firstValueFrom(
          this.httpService.get<BindInvoice>(`${this.apiUrl}/api/Invoices/${inv.ID}`, {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
          }),
        );
        // Merge detail data with list data, preserving Date from list
        // Detail endpoint uses CreationDate instead of Date
        const detailData = response.data;
        const mergedInvoice: BindInvoice = {
          ...detailData,
          Date: inv.Date || (detailData as any).CreationDate || detailData.Date,
        };
        invoicesWithDetails.push(mergedInvoice);

        if ((i + 1) % 10 === 0) {
          this.logger.log(`Fetched details for ${i + 1}/${allInvoices.length} invoices`);
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error: any) {
        this.logger.warn(`Failed to fetch invoice ${inv.ID}: ${error.message}`);
        // Use list data without details
        invoicesWithDetails.push(inv);
      }
    }

    return invoicesWithDetails;
  }

  /**
   * Sync invoices as orders to DB
   */
  private async syncInvoicesAsOrders(
    invoices: BindInvoice[],
    clientIdToNumberMap: Map<string, string>,
    existingBindIds: Set<string>,
  ): Promise<{ created: number; updated: number; errors: string[] }> {
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const invoice of invoices) {
      try {
        // Skip if already exists
        if (existingBindIds.has(invoice.ID)) {
          this.logger.debug(`Invoice ${invoice.ID} already exists, skipping`);
          continue;
        }

        const invoiceNumber = `${invoice.Series || 'FA'}${invoice.Number}`;

        // Fix clientNumber if it's a UUID
        let clientNumber = invoice.ClientID;
        if (clientIdToNumberMap.has(invoice.ClientID)) {
          clientNumber = clientIdToNumberMap.get(invoice.ClientID)!;
        }

        // Look up client to get the UUID for the relationship
        let clientId: string | null = null;
        const client = await this.clientRepository.findOne({ where: { clientNumber } });
        if (client) {
          clientId = client.id;
        }

        // Parse address from invoice
        const rawAddress = invoice.Address || '';
        const addressInfo = this.parseAddress(rawAddress);

        // Check if VIP
        const isVip = this.detectVip(invoice.Comments);

        // Create/get the client address
        let deliveryAddressId: string | null = null;
        if (rawAddress && clientNumber) {
          deliveryAddressId = await this.upsertClientAddress(clientNumber, {
            street: rawAddress,
            number: '',
            neighborhood: '',
            postalCode: addressInfo.postalCode,
            city: '',
            state: '',
          }, invoice.ID);
        }

        // Log invoice date for debugging
        this.logger.log(`Invoice ${invoiceNumber}: Date=${invoice.Date}, parsed=${this.parseBindDate(invoice.Date)}`);

        // Insert the order from invoice
        await this.orderRepository.insert({
          bindId: invoice.ID,
          bindInvoiceId: invoice.ID,
          orderNumber: invoiceNumber,
          invoiceNumber: invoiceNumber,
          orderSource: OrderSource.BIND_INVOICE,
          clientNumber,
          clientId,
          deliveryAddressId,
          clientName: this.cleanString(invoice.ClientName),
          clientEmail: '',
          clientPhone: invoice.ClientPhoneNumber || null,
          clientRfc: invoice.RFC || null,
          addressRaw: {
            street: rawAddress,
            number: '',
            neighborhood: '',
            postalCode: '',
            city: '',
            state: '',
            reference: invoice.Comments?.substring(0, 300),
          },
          totalAmount: invoice.Total || 0,
          isVip,
          promisedDate: this.parseBindDate(invoice.Date),
          status: OrderStatus.DRAFT,
          warehouseName: invoice.WarehouseName || null,
          employeeName: invoice.CreatedByName || null,
          bindClientId: invoice.ClientID,
        });
        created++;
        this.logger.log(`Created order from invoice ${invoiceNumber}`);
      } catch (error: any) {
        this.logger.warn(`Failed to sync invoice ${invoice.ID}: ${error.message}`);
        errors.push(`${invoice.Series || 'FA'}${invoice.Number}: ${error.message}`);
      }
    }

    return { created, updated, errors };
  }

  private parseAddress(address: string): {
    street: string;
    number: string;
    neighborhood: string;
    postalCode: string;
    city: string;
    state: string;
  } {
    const result = { street: '', number: '', neighborhood: '', postalCode: '', city: '', state: '' };
    if (!address) return result;

    // Format típico de Bind: "Calle 123 No. 45  Col. Colonia,  Ciudad, Estado  C.P 12345 País"

    // Extract postal code (C.P or CP followed by 5 digits)
    const cpMatch = address.match(/C\.?P\.?\s*(\d{5})/i);
    if (cpMatch) result.postalCode = cpMatch[1];

    // Extract neighborhood (Col. or Colonia followed by text until comma)
    const colMatch = address.match(/Col(?:onia)?\.?\s+([^,]+)/i);
    if (colMatch) result.neighborhood = colMatch[1].trim();

    // Extract street number (No. or # followed by number or S/N)
    const numMatch = address.match(/No\.?\s*(S\/N|\d+[A-Za-z\-]*)/i);
    if (numMatch) result.number = numMatch[1];

    // Extract city and state - typically after Col. section and before C.P
    // Format: "..., Ciudad, Estado C.P..." or "..., Ciudad, Estado, C.P..."
    const afterColMatch = address.match(/Col(?:onia)?\.?\s+[^,]+,\s*([^,]+),\s*([^,C]+?)(?:\s*C\.?P|,|\s*México$)/i);
    if (afterColMatch) {
      result.city = afterColMatch[1].trim();
      result.state = afterColMatch[2].trim();
    }

    // Street: everything before "Col." or "No."
    // First try to get everything before Col.
    const beforeColMatch = address.match(/^(.+?)(?:\s+Col\.?)/i);
    if (beforeColMatch) {
      let streetPart = beforeColMatch[1].trim();
      // If there's a No. in the street part, separate it
      const streetNoMatch = streetPart.match(/^(.+?)\s+No\.?\s*(S\/N|\d+[A-Za-z\-]*)$/i);
      if (streetNoMatch) {
        result.street = streetNoMatch[1].trim();
        if (!result.number) result.number = streetNoMatch[2];
      } else {
        result.street = streetPart;
      }
    } else {
      // Fallback: first part before comma
      result.street = address.split(',')[0]?.trim() || '';
    }

    return result;
  }

  /**
   * Normalize string for address comparison
   */
  private normalizeForComparison(str: string | null | undefined): string {
    return (str || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /**
   * Upsert client address with deduplication
   * Since Bind API provides the full address as a single text field,
   * we compare the complete normalized address string for deduplication.
   */
  private async upsertClientAddress(
    clientNumber: string,
    address: {
      street: string; // Contains full address text from Bind
      number: string;
      neighborhood: string;
      postalCode: string;
      city: string;
      state: string;
    },
    bindOrderId: string,
  ): Promise<string | null> {
    try {
      // Skip if no address
      if (!address.street) {
        return null;
      }

      // Normalize full address for comparison (street contains the complete address)
      const normalizedFullAddress = this.normalizeForComparison(address.street);

      // Get existing addresses for this client
      const existingAddresses = await this.clientAddressRepository.find({
        where: { clientNumber },
      });

      // Check if address already exists (compare full address text)
      const duplicate = existingAddresses.find(addr => {
        const existingNormalized = this.normalizeForComparison(addr.street);
        return existingNormalized === normalizedFullAddress;
      });

      if (duplicate) {
        // Update usage count
        await this.clientAddressRepository.update(duplicate.id, {
          useCount: duplicate.useCount + 1,
          lastUsedAt: new Date(),
        });
        this.logger.debug(`Address already exists for client ${clientNumber}, updated usage`);
        return duplicate.id; // Return existing address ID
      }

      // Get client ID for relationship
      const client = await this.clientRepository.findOne({ where: { clientNumber } });
      const clientId = client?.id || null;

      // Check if this is the first address (make it default)
      const isFirstAddress = existingAddresses.length === 0;

      // Create new address and get the ID
      const result = await this.clientAddressRepository.insert({
        clientNumber,
        clientId,
        street: address.street,
        number: address.number || null,
        neighborhood: address.neighborhood || null,
        postalCode: address.postalCode || null,
        city: address.city || null,
        state: address.state || null,
        isDefault: isFirstAddress,
        source: 'SYNC',
        bindSourceId: bindOrderId,
        useCount: 1,
        lastUsedAt: new Date(),
      });

      const newAddressId = result.identifiers[0]?.id;
      this.logger.log(`Created new address for client ${clientNumber}: ${address.street.substring(0, 50)}...`);
      return newAddressId || null;
    } catch (error: any) {
      this.logger.warn(`Failed to upsert client address: ${error.message}`);
      return null;
    }
  }

  private detectVip(comments?: string): boolean {
    if (!comments) return false;
    const upper = comments.toUpperCase();
    return upper.includes('VIP') || upper.includes('URGENTE') || upper.includes('PRIORITARIO');
  }

  private cleanString(str: string): string {
    if (!str) return '';
    return str.replace(/\s+/g, ' ').trim();
  }

  /**
   * Parse date from Bind API preserving the exact date.
   * Bind sends dates like "2026-01-16T00:00:00".
   * We extract just the date part (YYYY-MM-DD) and create a Date at UTC noon
   * to ensure PostgreSQL stores the correct date regardless of server timezone.
   */
  private parseBindDate(dateString: string | undefined): Date | undefined {
    if (!dateString) return undefined;

    // Extract just the date part (YYYY-MM-DD)
    const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) {
      return new Date(dateString);
    }

    // Create date at UTC noon to avoid timezone shifts
    // "2026-01-16T12:00:00Z" will always be January 16 in any timezone
    return new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00Z`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Sync job [${job.id}] completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Sync job [${job.id}] failed: ${error.message}`);
  }

  @OnWorkerEvent('progress')
  onProgress(job: Job, progress: number) {
    this.logger.log(`Sync job [${job.id}] progress: ${progress}%`);
  }
}
