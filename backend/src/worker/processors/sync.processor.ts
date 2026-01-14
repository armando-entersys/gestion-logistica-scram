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
import { OrderStatus } from '@/common/enums';

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
}

interface SyncJobResult {
  success: boolean;
  clients: { synced: number };
  orders: { created: number; updated: number; errors: string[] };
  message: string;
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
    this.logger.log(`Processing sync job [${job.id}]`);
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

      // Pause before fetching orders
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 3: Get existing order bind_ids
      const existingBindIds = await this.getExistingBindIds();
      await job.updateProgress(45);

      // Step 4: Fetch orders from Bind (differential)
      this.logger.log('Step 3: Fetching orders from Bind...');
      const orders = await this.fetchOrders(existingBindIds);
      await job.updateProgress(70);

      // Step 5: Sync orders to DB
      this.logger.log(`Step 4: Syncing ${orders.length} orders to DB...`);
      const orderResult = await this.syncOrders(orders, clientIdToNumberMap);
      await job.updateProgress(100);

      const result: SyncJobResult = {
        success: true,
        clients: { synced: clientResult.synced },
        orders: {
          created: orderResult.created,
          updated: orderResult.updated,
          errors: orderResult.errors,
        },
        message: `Sync completed: ${orderResult.created} orders created, ${clientResult.synced} clients synced`,
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
          await this.orderRepository.insert({
            bindId: order.ID,
            orderNumber,
            clientNumber,
            clientName: this.cleanString(order.ClientName),
            clientEmail: '',
            clientPhone: order.PhoneNumber || null,
            clientRfc: order.RFC || null,
            addressRaw: {
              street: addressInfo.street,
              number: addressInfo.number,
              neighborhood: addressInfo.neighborhood,
              postalCode: addressInfo.postalCode,
              city: addressInfo.city,
              state: addressInfo.state,
              reference: order.Comments?.substring(0, 300),
              original: rawAddress,
            },
            totalAmount: order.Total || 0,
            isVip: this.detectVip(order.Comments),
            promisedDate: order.OrderDate ? new Date(order.OrderDate) : undefined,
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

    // Extract postal code
    const cpMatch = address.match(/C\.?P\.?\s*(\d{5})/i);
    if (cpMatch) result.postalCode = cpMatch[1];

    // Extract neighborhood (Col. or Colonia)
    const colMatch = address.match(/Col(?:onia)?\.?\s+([^,]+)/i);
    if (colMatch) result.neighborhood = colMatch[1].trim();

    // Extract street number
    const numMatch = address.match(/(?:No\.?|#)\s*(\d+[A-Za-z]?)/i);
    if (numMatch) result.number = numMatch[1];

    // Street is everything before the first comma or number indicator
    const streetMatch = address.match(/^([^,#]+?)(?:\s+(?:No\.?|#|\d+)|,)/i);
    if (streetMatch) result.street = streetMatch[1].trim();
    else result.street = address.split(',')[0]?.trim() || '';

    return result;
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
