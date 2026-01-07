import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface GeocodingResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

interface GoogleGeocodingResponse {
  status: string;
  results: Array<{
    formatted_address: string;
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
  }>;
}

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://maps.googleapis.com/maps/api/geocode/json';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get('googleMaps.apiKey') || '';
  }

  /**
   * Geocodifica una dirección estructurada a coordenadas
   */
  async geocodeAddress(address: {
    street?: string;
    number?: string;
    neighborhood?: string;
    postalCode?: string;
    city?: string;
    state?: string;
  }): Promise<GeocodingResult | null> {
    if (!this.apiKey) {
      this.logger.warn('Google Maps API key not configured, skipping geocoding');
      return null;
    }

    // Construir dirección completa
    const addressParts: string[] = [];

    if (address.street) {
      const streetWithNumber = address.number
        ? `${address.street} ${address.number}`
        : address.street;
      addressParts.push(streetWithNumber);
    }

    if (address.neighborhood) {
      addressParts.push(address.neighborhood);
    }

    if (address.postalCode) {
      addressParts.push(`CP ${address.postalCode}`);
    }

    if (address.city) {
      addressParts.push(address.city);
    }

    if (address.state) {
      addressParts.push(address.state);
    }

    // Agregar país por defecto
    addressParts.push('México');

    const fullAddress = addressParts.join(', ');

    if (!fullAddress || fullAddress === 'México') {
      this.logger.warn('Empty address, skipping geocoding');
      return null;
    }

    try {
      this.logger.debug(`Geocoding address: ${fullAddress}`);

      const response = await firstValueFrom(
        this.httpService.get<GoogleGeocodingResponse>(this.baseUrl, {
          params: {
            address: fullAddress,
            key: this.apiKey,
            region: 'mx',
            language: 'es',
          },
        }),
      );

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const result = response.data.results[0];
        const coords = result.geometry.location;

        this.logger.debug(`Geocoded: ${fullAddress} -> ${coords.lat}, ${coords.lng}`);

        return {
          latitude: coords.lat,
          longitude: coords.lng,
          formattedAddress: result.formatted_address,
        };
      }

      if (response.data.status === 'ZERO_RESULTS') {
        this.logger.warn(`No geocoding results for: ${fullAddress}`);
        return null;
      }

      this.logger.warn(`Geocoding failed with status: ${response.data.status}`);
      return null;
    } catch (error) {
      this.logger.error(`Geocoding error for ${fullAddress}:`, error.message);
      return null;
    }
  }

  /**
   * Geocodifica múltiples direcciones en batch con rate limiting
   */
  async geocodeBatch(
    addresses: Array<{
      id: string;
      address: {
        street: string;
        number?: string;
        neighborhood?: string;
        postalCode?: string;
        city?: string;
        state?: string;
      };
    }>,
    delayMs = 100, // Delay entre requests para evitar rate limiting
  ): Promise<Map<string, GeocodingResult | null>> {
    const results = new Map<string, GeocodingResult | null>();

    for (const item of addresses) {
      const result = await this.geocodeAddress(item.address);
      results.set(item.id, result);

      // Pequeño delay para evitar rate limiting
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }
}
