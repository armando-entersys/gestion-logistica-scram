import { Injectable, Logger, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './entities/client.entity';
import { CreateClientDto, UpdateClientDto, ClientFilterDto } from './dto';
import { ClientAddressesService } from '@/modules/client-addresses/client-addresses.service';
import { SyncClientDto } from '@/modules/sync/adapters/bind.adapter';

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @Inject(forwardRef(() => ClientAddressesService))
    private readonly clientAddressesService: ClientAddressesService,
  ) {}

  /**
   * Find all clients with pagination and filters
   */
  async findAll(filters: ClientFilterDto): Promise<{
    data: (Client & { orderCount: number; addressCount: number })[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.clientRepo
      .createQueryBuilder('client')
      .loadRelationCountAndMap('client.orderCount', 'client.orders')
      .loadRelationCountAndMap('client.addressCount', 'client.addresses');

    if (filters.search) {
      queryBuilder.andWhere(
        '(client.name ILIKE :search OR client.clientNumber ILIKE :search OR client.rfc ILIKE :search OR client.email ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    if (filters.isVip !== undefined) {
      queryBuilder.andWhere('client.isVip = :isVip', { isVip: filters.isVip });
    }

    queryBuilder
      .orderBy('client.name', 'ASC')
      .skip(skip)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();
    return { data: data as (Client & { orderCount: number; addressCount: number })[], total, page, limit };
  }

  /**
   * Find client by ID
   */
  async findOne(id: string): Promise<Client> {
    const client = await this.clientRepo.findOne({
      where: { id },
      relations: ['addresses', 'orders'],
    });

    if (!client) {
      throw new NotFoundException(`Cliente ${id} no encontrado`);
    }

    return client;
  }

  /**
   * Find client by client number
   */
  async findByClientNumber(clientNumber: string): Promise<Client | null> {
    return this.clientRepo.findOne({
      where: { clientNumber },
      relations: ['addresses', 'orders'],
    });
  }

  /**
   * Find client with full details (addresses + orders)
   */
  async findOneWithDetails(id: string): Promise<Client & { addressCount: number; orderCount: number }> {
    const client = await this.clientRepo.findOne({
      where: { id },
      relations: ['addresses', 'orders'],
    });

    if (!client) {
      throw new NotFoundException(`Cliente ${id} no encontrado`);
    }

    return {
      ...client,
      addressCount: client.addresses?.length || 0,
      orderCount: client.orders?.length || 0,
    };
  }

  /**
   * Create or update client (upsert by clientNumber)
   */
  async upsertClient(dto: CreateClientDto, source: 'SYNC' | 'MANUAL' = 'SYNC'): Promise<Client> {
    let client = await this.clientRepo.findOne({
      where: { clientNumber: dto.clientNumber },
    });

    if (client) {
      // Update existing client - only update if values are provided
      const updateData: Partial<Client> = {};

      if (dto.name && dto.name !== client.name) updateData.name = dto.name;
      if (dto.email && dto.email !== client.email) updateData.email = dto.email;
      if (dto.phone && dto.phone !== client.phone) updateData.phone = dto.phone;
      if (dto.rfc && dto.rfc !== client.rfc) updateData.rfc = dto.rfc;
      if (dto.isVip !== undefined) updateData.isVip = dto.isVip;

      if (Object.keys(updateData).length > 0) {
        await this.clientRepo.update(client.id, updateData);
        this.logger.debug(`Updated client ${dto.clientNumber}`);
      }

      return this.clientRepo.findOne({ where: { id: client.id } }) as Promise<Client>;
    }

    // Create new client
    client = this.clientRepo.create({
      clientNumber: dto.clientNumber,
      name: dto.name,
      email: dto.email || null,
      phone: dto.phone || null,
      rfc: dto.rfc || null,
      category: dto.category || null,
      notes: dto.notes || null,
      isVip: dto.isVip || false,
      bindSource: source,
      totalOrders: 0,
      totalAmount: 0,
    });

    const saved = await this.clientRepo.save(client);
    this.logger.log(`Created new client ${dto.clientNumber}: ${dto.name}`);
    return saved;
  }

  /**
   * Update client
   */
  async update(id: string, dto: UpdateClientDto): Promise<Client> {
    const client = await this.findOne(id);

    await this.clientRepo.update(id, {
      name: dto.name ?? client.name,
      email: dto.email ?? client.email,
      phone: dto.phone ?? client.phone,
      rfc: dto.rfc ?? client.rfc,
      category: dto.category ?? client.category,
      notes: dto.notes ?? client.notes,
      isVip: dto.isVip ?? client.isVip,
    });

    return this.findOne(id);
  }

  /**
   * Increment order stats for a client
   */
  async incrementOrderStats(clientNumber: string, orderAmount: number): Promise<void> {
    await this.clientRepo
      .createQueryBuilder()
      .update(Client)
      .set({
        totalOrders: () => '"total_orders" + 1',
        totalAmount: () => `"total_amount" + ${orderAmount || 0}`,
        lastOrderAt: new Date(),
      })
      .where('clientNumber = :clientNumber', { clientNumber })
      .execute();
  }

  /**
   * Get client statistics
   */
  async getStats(): Promise<{
    totalClients: number;
    vipClients: number;
    totalRevenue: number;
    averageOrderValue: number;
  }> {
    const totalClients = await this.clientRepo.count();
    const vipClients = await this.clientRepo.count({ where: { isVip: true } });

    const statsResult = await this.clientRepo
      .createQueryBuilder('client')
      .select('SUM(client.totalAmount)', 'totalRevenue')
      .addSelect('SUM(client.totalOrders)', 'totalOrders')
      .getRawOne();

    const totalRevenue = parseFloat(statsResult?.totalRevenue || '0');
    const totalOrders = parseInt(statsResult?.totalOrders || '0', 10);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      totalClients,
      vipClients,
      totalRevenue,
      averageOrderValue,
    };
  }

  /**
   * Delete client
   */
  async remove(id: string): Promise<void> {
    const client = await this.findOne(id);
    await this.clientRepo.delete(id);
    this.logger.log(`Deleted client ${client.clientNumber}`);
  }

  /**
   * Find client by Bind ID (UUID)
   */
  async findByBindId(bindId: string): Promise<Client | null> {
    return this.clientRepo.findOne({
      where: { bindId },
    });
  }

  /**
   * Create a client from Bind ERP data (used by webhooks)
   */
  async createFromBind(data: {
    bindId: string;
    name: string;
    email?: string;
    phone?: string;
    rfc?: string;
    city?: string;
    state?: string;
  }): Promise<Client> {
    // Generate a unique client number if not provided
    const clientNumber = `BIND-${data.bindId.substring(0, 8).toUpperCase()}`;

    // Check if client already exists by bindId
    const existing = await this.findByBindId(data.bindId);
    if (existing) {
      return existing;
    }

    const client = this.clientRepo.create({
      bindId: data.bindId,
      clientNumber,
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      rfc: data.rfc || null,
      bindSource: 'SYNC',
      totalOrders: 0,
      totalAmount: 0,
    });

    const saved = await this.clientRepo.save(client);
    this.logger.log(`Created client from Bind webhook: ${clientNumber} - ${data.name}`);
    return saved;
  }

  /**
   * Sync clients from Bind ERP with their addresses
   */
  async syncClients(clients: SyncClientDto[]): Promise<{ synced: number; addresses: number }> {
    let syncedCount = 0;
    let addressCount = 0;

    for (const syncClient of clients) {
      try {
        // Upsert the client
        const client = await this.upsertClient({
          clientNumber: syncClient.clientNumber,
          name: syncClient.name,
          email: syncClient.email,
          phone: syncClient.phone,
          rfc: syncClient.rfc,
        }, 'SYNC');

        syncedCount++;

        // Process addresses if available
        if (syncClient.addresses && syncClient.addresses.length > 0) {
          for (const addressText of syncClient.addresses) {
            if (!addressText || addressText.trim() === '') continue;

            try {
              // Parse the address text and save it
              await this.clientAddressesService.upsertFromText(
                syncClient.clientNumber,
                addressText,
                'SYNC',
              );
              addressCount++;
            } catch (addrError) {
              this.logger.warn(`Failed to save address for client ${syncClient.clientNumber}: ${addrError.message}`);
            }
          }
        }
      } catch (error) {
        this.logger.error(`Failed to sync client ${syncClient.clientNumber}: ${error.message}`);
      }
    }

    this.logger.log(`Synced ${syncedCount} clients with ${addressCount} addresses from Bind`);
    return { synced: syncedCount, addresses: addressCount };
  }
}
