import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ClientAddress } from './entities/client-address.entity';
import { CreateClientAddressDto } from './dto';
import { GeocodingService } from '@/common/services/geocoding.service';

@Injectable()
export class ClientAddressesService {
  private readonly logger = new Logger(ClientAddressesService.name);

  constructor(
    @InjectRepository(ClientAddress)
    private readonly addressRepo: Repository<ClientAddress>,
    private readonly geocodingService: GeocodingService,
  ) {}

  /**
   * Get all addresses for a client, sorted by default first, then by use_count
   */
  async findByClient(clientNumber: string): Promise<ClientAddress[]> {
    return this.addressRepo.find({
      where: { clientNumber },
      order: { isDefault: 'DESC', useCount: 'DESC', lastUsedAt: 'DESC' },
    });
  }

  /**
   * Create or find existing address (deduplication based on street+number+postalCode)
   */
  async upsertAddress(
    dto: CreateClientAddressDto,
    source: 'SYNC' | 'MANUAL' = 'MANUAL',
    bindSourceId?: string,
  ): Promise<ClientAddress | null> {
    // Skip if no client number or street
    if (!dto.clientNumber || !dto.street) {
      this.logger.debug('Skipping address upsert: missing clientNumber or street');
      return null;
    }

    // Check for existing address with same key fields
    const existingQuery = this.addressRepo
      .createQueryBuilder('addr')
      .where('addr.clientNumber = :clientNumber', { clientNumber: dto.clientNumber })
      .andWhere('LOWER(addr.street) = LOWER(:street)', { street: dto.street || '' });

    if (dto.number) {
      existingQuery.andWhere('LOWER(addr.number) = LOWER(:number)', { number: dto.number });
    } else {
      existingQuery.andWhere('(addr.number IS NULL OR addr.number = :empty)', { empty: '' });
    }

    if (dto.postalCode) {
      existingQuery.andWhere('addr.postalCode = :postalCode', { postalCode: dto.postalCode });
    }

    const existing = await existingQuery.getOne();

    if (existing) {
      // Update use count and last used
      this.logger.debug(`Address already exists for client ${dto.clientNumber}, updating usage`);
      await this.addressRepo.update(existing.id, {
        useCount: existing.useCount + 1,
        lastUsedAt: new Date(),
      });
      return existing;
    }

    // Check if this is the first address for this client
    const count = await this.addressRepo.count({ where: { clientNumber: dto.clientNumber } });
    const isFirstAddress = count === 0;

    // Create new address
    const address = this.addressRepo.create({
      clientNumber: dto.clientNumber,
      label: dto.label || null,
      street: dto.street || null,
      number: dto.number || null,
      neighborhood: dto.neighborhood || null,
      postalCode: dto.postalCode || null,
      city: dto.city || null,
      state: dto.state || null,
      reference: dto.reference || null,
      latitude: dto.latitude || null,
      longitude: dto.longitude || null,
      isDefault: dto.isDefault ?? isFirstAddress, // First address is default
      source,
      bindSourceId: bindSourceId || null,
      useCount: 1,
      lastUsedAt: new Date(),
    });

    // Geocode if no coordinates provided
    if (!address.latitude || !address.longitude) {
      try {
        const geoResult = await this.geocodingService.geocodeAddress({
          street: dto.street,
          number: dto.number,
          neighborhood: dto.neighborhood,
          postalCode: dto.postalCode,
          city: dto.city,
          state: dto.state,
        });
        if (geoResult) {
          address.latitude = geoResult.latitude;
          address.longitude = geoResult.longitude;
        }
      } catch (error) {
        this.logger.warn(`Failed to geocode address: ${error.message}`);
      }
    }

    this.logger.log(`Creating new address for client ${dto.clientNumber}: ${dto.street}`);
    return this.addressRepo.save(address);
  }

  /**
   * Set an address as default for a client (unset others)
   */
  async setDefault(clientNumber: string, addressId: string): Promise<void> {
    // Unset all defaults for this client
    await this.addressRepo.update(
      { clientNumber },
      { isDefault: false },
    );
    // Set the specified address as default
    await this.addressRepo.update(addressId, { isDefault: true });
    this.logger.log(`Set address ${addressId} as default for client ${clientNumber}`);
  }

  /**
   * Record usage when address is selected for an order
   */
  async recordUsage(addressId: string): Promise<void> {
    await this.addressRepo.increment({ id: addressId }, 'useCount', 1);
    await this.addressRepo.update(addressId, { lastUsedAt: new Date() });
  }

  /**
   * Delete an address
   */
  async remove(id: string): Promise<void> {
    await this.addressRepo.delete(id);
    this.logger.log(`Deleted address ${id}`);
  }

  /**
   * Update address label
   */
  async updateLabel(id: string, label: string): Promise<ClientAddress | null> {
    await this.addressRepo.update(id, { label });
    return this.addressRepo.findOne({ where: { id } });
  }
}
