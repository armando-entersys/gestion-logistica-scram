import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './entities/client.entity';
import { CreateClientDto, UpdateClientDto, ClientFilterDto } from './dto';

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  /**
   * Find all clients with pagination and filters
   */
  async findAll(filters: ClientFilterDto): Promise<{
    data: Client[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.clientRepo.createQueryBuilder('client');

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
      .orderBy('client.totalOrders', 'DESC')
      .addOrderBy('client.name', 'ASC')
      .skip(skip)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();
    return { data, total, page, limit };
  }

  /**
   * Find client by ID
   */
  async findOne(id: string): Promise<Client> {
    const client = await this.clientRepo.findOne({
      where: { id },
      relations: ['addresses'],
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
      relations: ['addresses'],
    });
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
}
