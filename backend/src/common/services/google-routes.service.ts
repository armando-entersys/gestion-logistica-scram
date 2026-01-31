import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface Waypoint {
  location: {
    latLng: {
      latitude: number;
      longitude: number;
    };
  };
}

interface RouteLeg {
  distanceMeters: number;
  duration: string;
  startLocation: { latLng: { latitude: number; longitude: number } };
  endLocation: { latLng: { latitude: number; longitude: number } };
}

interface RouteOptimizationResponse {
  routes: Array<{
    legs: RouteLeg[];
    distanceMeters: number;
    duration: string;
    optimizedIntermediateWaypointIndex?: number[];
  }>;
}

@Injectable()
export class GoogleRoutesService {
  private readonly logger = new Logger(GoogleRoutesService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://routes.googleapis.com/directions/v2:computeRoutes';

  // Base SCRAM - Cuautitlan Izcalli
  private readonly baseLocation = {
    latitude: 19.6505,
    longitude: -99.2168,
  };

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get('googleMaps.apiKey') || '';
  }

  /**
   * Optimiza el orden de waypoints usando Google Routes API
   * @param waypoints Array de coordenadas [{latitude, longitude, orderId}]
   * @param departureTime Hora de salida opcional (ISO string)
   * @returns Orden optimizado de indices y metricas
   */
  async optimizeWaypoints(
    waypoints: Array<{ latitude: number; longitude: number; orderId: string }>,
    departureTime?: string,
  ): Promise<{
    optimizedOrder: number[];
    totalDistanceMeters: number;
    totalDurationSeconds: number;
    legs: Array<{
      distanceMeters: number;
      durationSeconds: number;
      waypointIndex: number;
    }>;
  } | null> {
    if (!this.apiKey) {
      this.logger.warn('Google Maps API key not configured, skipping route optimization');
      return null;
    }

    if (waypoints.length < 2) {
      this.logger.warn('Need at least 2 waypoints to optimize');
      return null;
    }

    // Google Routes API limit
    if (waypoints.length > 25) {
      this.logger.warn(`Too many waypoints (${waypoints.length}), limiting to 25`);
      waypoints = waypoints.slice(0, 25);
    }

    try {
      const intermediates: Waypoint[] = waypoints.map((wp) => ({
        location: {
          latLng: {
            latitude: wp.latitude,
            longitude: wp.longitude,
          },
        },
      }));

      const request: any = {
        origin: {
          location: {
            latLng: this.baseLocation,
          },
        },
        destination: {
          location: {
            latLng: this.baseLocation,
          },
        },
        intermediates,
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        optimizeWaypointOrder: true,
      };

      if (departureTime) {
        request.departureTime = departureTime;
      }

      this.logger.debug(`Optimizing route with ${waypoints.length} waypoints`);

      const response = await firstValueFrom(
        this.httpService.post<RouteOptimizationResponse>(
          this.baseUrl,
          request,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': this.apiKey,
              'X-Goog-FieldMask': 'routes.legs,routes.distanceMeters,routes.duration,routes.optimizedIntermediateWaypointIndex',
            },
          },
        ),
      );

      if (!response.data.routes || response.data.routes.length === 0) {
        this.logger.warn('No routes returned from Google Routes API');
        return null;
      }

      const route = response.data.routes[0];
      const optimizedOrder = route.optimizedIntermediateWaypointIndex ||
        waypoints.map((_, i) => i);

      const parseDuration = (dur: string): number => {
        if (!dur) return 0;
        return parseInt(dur.replace('s', ''), 10) || 0;
      };

      const totalDurationSeconds = parseDuration(route.duration);

      // Map legs (excluding return to origin)
      const legs = route.legs.slice(0, -1).map((leg, index) => ({
        distanceMeters: leg.distanceMeters || 0,
        durationSeconds: parseDuration(leg.duration),
        waypointIndex: optimizedOrder[index] !== undefined ? optimizedOrder[index] : index,
      }));

      this.logger.debug(`Route optimized: ${route.distanceMeters}m, ${totalDurationSeconds}s`);

      return {
        optimizedOrder,
        totalDistanceMeters: route.distanceMeters || 0,
        totalDurationSeconds,
        legs,
      };
    } catch (error) {
      this.logger.error('Error calling Google Routes API:', error.message);
      if (error.response?.data) {
        this.logger.error('API response:', JSON.stringify(error.response.data));
      }
      return null;
    }
  }

  /**
   * Calcula distancia de ruta sin optimizar (para comparacion)
   */
  async calculateRouteDistance(
    waypoints: Array<{ latitude: number; longitude: number }>,
  ): Promise<number | null> {
    if (!this.apiKey || waypoints.length < 1) return null;

    try {
      const intermediates: Waypoint[] = waypoints.map((wp) => ({
        location: {
          latLng: {
            latitude: wp.latitude,
            longitude: wp.longitude,
          },
        },
      }));

      const request = {
        origin: { location: { latLng: this.baseLocation } },
        destination: { location: { latLng: this.baseLocation } },
        intermediates,
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        optimizeWaypointOrder: false,
      };

      const response = await firstValueFrom(
        this.httpService.post<RouteOptimizationResponse>(
          this.baseUrl,
          request,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': this.apiKey,
              'X-Goog-FieldMask': 'routes.distanceMeters',
            },
          },
        ),
      );

      return response.data.routes?.[0]?.distanceMeters || null;
    } catch (error) {
      this.logger.error('Error calculating route distance:', error.message);
      return null;
    }
  }
}
