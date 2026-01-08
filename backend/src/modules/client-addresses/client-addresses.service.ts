import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ClientAddress } from './entities/client-address.entity';
import { Client } from '@/modules/clients/entities/client.entity';
import { CreateClientAddressDto } from './dto';
import { GeocodingService } from '@/common/services/geocoding.service';

@Injectable()
export class ClientAddressesService {
  private readonly logger = new Logger(ClientAddressesService.name);

  constructor(
    @InjectRepository(ClientAddress)
    private readonly addressRepo: Repository<ClientAddress>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
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
   * Normalize string for comparison (trim, lowercase, remove extra spaces)
   */
  private normalizeString(str: string | null | undefined): string {
    return (str || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /**
   * Create or find existing address (deduplication based on normalized street+number)
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

    // Normalize input for comparison
    const normalizedStreet = this.normalizeString(dto.street);
    const normalizedNumber = this.normalizeString(dto.number);

    // Get all addresses for this client and check for duplicates
    const clientAddresses = await this.addressRepo.find({
      where: { clientNumber: dto.clientNumber },
    });

    // Find existing address with same street and number (normalized)
    const existing = clientAddresses.find(addr => {
      const addrStreet = this.normalizeString(addr.street);
      const addrNumber = this.normalizeString(addr.number);

      // Match if street is the same and number is the same (or both empty)
      return addrStreet === normalizedStreet && addrNumber === normalizedNumber;
    });

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

    // Look up client to get clientId for the relationship
    let clientId: string | null = null;
    try {
      const client = await this.clientRepo.findOne({ where: { clientNumber: dto.clientNumber } });
      if (client) {
        clientId = client.id;
      }
    } catch (err) {
      this.logger.warn(`Could not find client by number ${dto.clientNumber}: ${err.message}`);
    }

    // Create new address
    const address = this.addressRepo.create({
      clientNumber: dto.clientNumber,
      clientId,
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

  /**
   * Parse raw address text from Bind and upsert
   * Address format varies but typically: "Street Number, Neighborhood, PostalCode City, State"
   */
  async upsertFromText(
    clientNumber: string,
    addressText: string,
    source: 'SYNC' | 'MANUAL' = 'SYNC',
  ): Promise<ClientAddress | null> {
    if (!addressText || addressText.trim() === '') {
      return null;
    }

    const parsed = this.parseAddressText(addressText);

    return this.upsertAddress({
      clientNumber,
      street: parsed.street,
      number: parsed.number,
      neighborhood: parsed.neighborhood,
      postalCode: parsed.postalCode,
      city: parsed.city,
      state: parsed.state,
    }, source);
  }

  /**
   * Parse raw address text into components
   * Attempts to extract street, number, neighborhood, postal code, city, state
   */
  private parseAddressText(text: string): {
    street?: string;
    number?: string;
    neighborhood?: string;
    postalCode?: string;
    city?: string;
    state?: string;
  } {
    // Clean up the text
    const cleaned = text.trim().replace(/\s+/g, ' ');

    // Split by commas first
    const parts = cleaned.split(',').map(p => p.trim()).filter(p => p);

    const result: {
      street?: string;
      number?: string;
      neighborhood?: string;
      postalCode?: string;
      city?: string;
      state?: string;
    } = {};

    // Try to extract postal code (5 digits in Mexico)
    const postalCodeMatch = cleaned.match(/\b(\d{5})\b/);
    if (postalCodeMatch) {
      result.postalCode = postalCodeMatch[1];
    }

    // First part usually contains street and number
    if (parts.length >= 1) {
      const firstPart = parts[0];
      // Try to extract number from end of first part
      const numberMatch = firstPart.match(/^(.+?)\s+(?:#|No\.?|Num\.?)?\s*(\d+[A-Za-z]?)$/i);
      if (numberMatch) {
        result.street = numberMatch[1].trim();
        result.number = numberMatch[2].trim();
      } else {
        result.street = firstPart;
      }
    }

    // Second part is often neighborhood (Col., Colonia, Fracc., etc.)
    if (parts.length >= 2) {
      const secondPart = parts[1];
      // Remove common prefixes
      const neighborhoodClean = secondPart
        .replace(/^(Col\.?|Colonia|Fracc\.?|Fraccionamiento|Barrio|Bo\.?)\s*/i, '')
        .trim();
      result.neighborhood = neighborhoodClean || secondPart;
    }

    // Third and fourth parts are city and state
    if (parts.length >= 3) {
      // Check if this part contains postal code
      const thirdPart = parts[2].replace(/\d{5}/, '').trim();
      if (thirdPart) {
        result.city = thirdPart;
      }
    }

    if (parts.length >= 4) {
      result.state = parts[3];
    }

    // If city not found, try to extract from part with postal code
    if (!result.city && result.postalCode) {
      const cityMatch = cleaned.match(/\d{5}\s+([^,]+)/);
      if (cityMatch) {
        result.city = cityMatch[1].trim();
      }
    }

    return result;
  }
}
