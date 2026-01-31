import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { Order } from '../orders/entities/order.entity';
import { OrderStatus, PriorityLevel } from '@/common/enums';
import { GoogleRoutesService } from '@/common/services/google-routes.service';
import { OptimizationResult, OptimizationLeg } from './dto/optimize-route.dto';

@Injectable()
export class RoutesService {
  private readonly logger = new Logger(RoutesService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly configService: ConfigService,
    private readonly googleRoutesService: GoogleRoutesService,
  ) {}

  /**
   * Get orders ready for route planning
   */
  async getOrdersForPlanning(): Promise<Order[]> {
    return this.orderRepository.find({
      where: {
        status: In([OrderStatus.DRAFT, OrderStatus.READY]),
      },
      order: {
        priorityLevel: 'DESC',
        createdAt: 'ASC',
      },
    });
  }

  /**
   * Get active routes (orders in transit)
   */
  async getActiveRoutes(): Promise<Map<string, Order[]>> {
    const orders = await this.orderRepository.find({
      where: { status: OrderStatus.IN_TRANSIT },
      relations: ['assignedDriver'],
      order: { routePosition: 'ASC' },
    });

    // Group by driver
    const routesByDriver = new Map<string, Order[]>();

    for (const order of orders) {
      const driverId = order.assignedDriverId || 'unassigned';
      if (!routesByDriver.has(driverId)) {
        routesByDriver.set(driverId, []);
      }
      routesByDriver.get(driverId)!.push(order);
    }

    return routesByDriver;
  }

  /**
   * Calculate ETA for route stops
   * RF-12: Algoritmo de Cálculo de ETA
   */
  calculateETAs(
    orderIds: string[],
    startTime: string = '09:00',
  ): Array<{ orderId: string; etaStart: Date; etaEnd: Date }> {
    const avgStopTime = this.configService.get<number>('business.averageStopTimeMinutes') || 30;
    const bufferPercent = this.configService.get<number>('business.trafficBufferPercent') || 15;

    const [hours, minutes] = startTime.split(':').map(Number);
    const baseTime = new Date();
    baseTime.setHours(hours, minutes, 0, 0);

    return orderIds.map((orderId, index) => {
      const minutesToAdd = index * avgStopTime;
      const bufferMinutes = Math.ceil(minutesToAdd * (bufferPercent / 100));

      const etaStart = new Date(baseTime.getTime() + minutesToAdd * 60000);
      const etaEnd = new Date(etaStart.getTime() + (avgStopTime + bufferMinutes) * 60000);

      return { orderId, etaStart, etaEnd };
    });
  }

  /**
   * Get orders near a location (for map clustering)
   */
  async getOrdersNearLocation(
    latitude: number,
    longitude: number,
    radiusKm: number = 10,
  ): Promise<Order[]> {
    // Using PostGIS ST_DWithin for efficient spatial query
    return this.orderRepository
      .createQueryBuilder('order')
      .where(
        `ST_DWithin(
          order.address_geo::geography,
          ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
          :radius
        )`,
        {
          latitude,
          longitude,
          radius: radiusKm * 1000, // Convert to meters
        },
      )
      .andWhere('order.status IN (:...statuses)', {
        statuses: [OrderStatus.DRAFT, OrderStatus.READY],
      })
      .getMany();
  }

  /**
   * Optimiza la ruta de un conjunto de ordenes usando Google Routes API
   * RF-13: Optimizacion de Rutas con IA
   */
  async optimizeRoute(
    orderIds: string[],
    startTime: string = '09:00',
    respectPriority: boolean = true,
  ): Promise<{ optimization: OptimizationResult; warnings: string[] }> {
    const warnings: string[] = [];

    // 1. Obtener ordenes
    const orders = await this.orderRepository.find({
      where: { id: In(orderIds) },
    });

    if (orders.length !== orderIds.length) {
      const foundIds = orders.map((o) => o.id);
      const missingIds = orderIds.filter((id) => !foundIds.includes(id));
      warnings.push(`${missingIds.length} ordenes no encontradas`);
    }

    // Filtrar ordenes sin coordenadas
    const ordersWithCoords = orders.filter((o) => o.latitude && o.longitude);
    const ordersWithoutCoords = orders.filter((o) => !o.latitude || !o.longitude);

    if (ordersWithoutCoords.length > 0) {
      warnings.push(
        `${ordersWithoutCoords.length} ordenes sin geocodificar: ${ordersWithoutCoords.map((o) => o.orderNumber || o.bindId).join(', ')}`,
      );
    }

    if (ordersWithCoords.length < 2) {
      throw new Error('Se requieren al menos 2 ordenes geocodificadas para optimizar');
    }

    // 2. Preparar resultado
    let finalOptimizedIds: string[] = [];
    let totalDistanceMeters = 0;
    let totalDurationSeconds = 0;
    const allLegs: OptimizationLeg[] = [];

    if (respectPriority) {
      // Separar en buckets por prioridad
      const criticalOrders = ordersWithCoords.filter((o) => o.priorityLevel === PriorityLevel.CRITICAL);
      const highOrders = ordersWithCoords.filter((o) => o.priorityLevel === PriorityLevel.HIGH);
      const normalOrders = ordersWithCoords.filter((o) => o.priorityLevel === PriorityLevel.NORMAL);

      const buckets = [
        { name: 'CRITICAL', orders: criticalOrders },
        { name: 'HIGH', orders: highOrders },
        { name: 'NORMAL', orders: normalOrders },
      ];

      let currentPosition = 1;
      let currentTime = this.parseStartTime(startTime);

      for (const bucket of buckets) {
        if (bucket.orders.length === 0) continue;

        if (bucket.orders.length === 1) {
          const order = bucket.orders[0];
          finalOptimizedIds.push(order.id);
          allLegs.push(this.createOptimizationLeg(order, currentPosition, currentTime, 0, 30));
          currentPosition++;
          currentTime = new Date(currentTime.getTime() + 30 * 60000);
          continue;
        }

        const waypoints = bucket.orders.map((o) => ({
          latitude: Number(o.latitude),
          longitude: Number(o.longitude),
          orderId: o.id,
        }));

        let result = null;
        let optimizeError = '';
        try {
          result = await this.googleRoutesService.optimizeWaypoints(
            waypoints,
            currentTime.toISOString(),
          );
        } catch (error) {
          optimizeError = error.message || 'Unknown error';
          this.logger.error(`Error optimizing bucket ${bucket.name}: ${optimizeError}`);
        }

        if (result) {
          totalDistanceMeters += result.totalDistanceMeters;
          totalDurationSeconds += result.totalDurationSeconds;

          for (const idx of result.optimizedOrder) {
            const order = bucket.orders[idx];
            const leg = result.legs.find((l) => l.waypointIndex === idx);

            finalOptimizedIds.push(order.id);
            allLegs.push(
              this.createOptimizationLeg(
                order,
                currentPosition,
                currentTime,
                (leg?.distanceMeters || 0) / 1000,
                (leg?.durationSeconds || 1800) / 60,
              ),
            );

            currentPosition++;
            currentTime = new Date(currentTime.getTime() + (leg?.durationSeconds || 1800) * 1000 + 15 * 60000);
          }
        } else {
          // Fallback: mantener orden original
          for (const order of bucket.orders) {
            finalOptimizedIds.push(order.id);
            allLegs.push(this.createOptimizationLeg(order, currentPosition, currentTime, 0, 30));
            currentPosition++;
            currentTime = new Date(currentTime.getTime() + 30 * 60000);
          }
          const errorDetail = optimizeError === 'API_KEY_MISSING'
            ? 'GOOGLE_MAPS_API_KEY no configurada'
            : optimizeError
              ? `Error: ${optimizeError}`
              : 'Google Routes API no disponible (verificar que Routes API esté habilitada en Google Cloud Console)';
          warnings.push(`No se pudo optimizar bucket ${bucket.name}: ${errorDetail}`);
        }
      }
    } else {
      // Optimizar todo junto sin respetar prioridades
      const waypoints = ordersWithCoords.map((o) => ({
        latitude: Number(o.latitude),
        longitude: Number(o.longitude),
        orderId: o.id,
      }));

      let result = null;
      let optimizeError = '';
      try {
        result = await this.googleRoutesService.optimizeWaypoints(
          waypoints,
          this.parseStartTime(startTime).toISOString(),
        );
      } catch (error) {
        optimizeError = error.message || 'Unknown error';
        this.logger.error(`Error optimizing route: ${optimizeError}`);
      }

      if (result) {
        totalDistanceMeters = result.totalDistanceMeters;
        totalDurationSeconds = result.totalDurationSeconds;

        let currentTime = this.parseStartTime(startTime);
        let position = 1;

        for (const idx of result.optimizedOrder) {
          const order = ordersWithCoords[idx];
          const leg = result.legs.find((l) => l.waypointIndex === idx);

          finalOptimizedIds.push(order.id);
          allLegs.push(
            this.createOptimizationLeg(
              order,
              position,
              currentTime,
              (leg?.distanceMeters || 0) / 1000,
              (leg?.durationSeconds || 1800) / 60,
            ),
          );

          position++;
          currentTime = new Date(currentTime.getTime() + (leg?.durationSeconds || 1800) * 1000 + 15 * 60000);
        }

        // Advertir si hay ordenes urgentes en posiciones bajas
        for (let i = 0; i < allLegs.length; i++) {
          const leg = allLegs[i];
          if (leg.priority === PriorityLevel.CRITICAL && i > 2) {
            warnings.push(`Orden urgente en posicion ${i + 1} - considere activar "Respetar Prioridades"`);
          }
        }
      } else {
        // Fallback
        finalOptimizedIds = ordersWithCoords.map((o) => o.id);
        let currentTime = this.parseStartTime(startTime);
        ordersWithCoords.forEach((order, idx) => {
          allLegs.push(this.createOptimizationLeg(order, idx + 1, currentTime, 0, 30));
          currentTime = new Date(currentTime.getTime() + 30 * 60000);
        });
        const errorDetail = optimizeError === 'API_KEY_MISSING'
          ? 'GOOGLE_MAPS_API_KEY no configurada'
          : optimizeError
            ? `Error: ${optimizeError}`
            : 'Google Routes API no disponible (verificar que Routes API esté habilitada en Google Cloud Console)';
        warnings.push(`No se pudo optimizar: ${errorDetail}`);
      }
    }

    // 3. Calcular distancia original para comparacion
    const originalOrderedWaypoints = orderIds
      .map((id) => orders.find((o) => o.id === id))
      .filter((o): o is Order => !!o && !!o.latitude && !!o.longitude)
      .map((o) => ({ latitude: Number(o.latitude), longitude: Number(o.longitude) }));

    const originalDistanceMeters = await this.googleRoutesService.calculateRouteDistance(originalOrderedWaypoints) || 0;

    // 4. Calcular ahorros
    const totalDistanceKm = totalDistanceMeters / 1000;
    const originalDistanceKm = originalDistanceMeters / 1000;
    const savingsKm = originalDistanceKm - totalDistanceKm;
    const savingsPercent = originalDistanceKm > 0
      ? ((savingsKm / originalDistanceKm) * 100)
      : 0;

    if (savingsPercent < 10 && savingsPercent > -10 && savingsPercent !== 0) {
      warnings.push('La ruta ya esta bastante optimizada (ahorro < 10%)');
    }

    return {
      optimization: {
        originalSequence: orderIds,
        optimizedSequence: finalOptimizedIds,
        totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
        originalDistanceKm: Math.round(originalDistanceKm * 10) / 10,
        totalDurationMinutes: Math.round(totalDurationSeconds / 60),
        savingsPercent: Math.round(savingsPercent * 10) / 10,
        savingsKm: Math.round(savingsKm * 10) / 10,
        legs: allLegs,
      },
      warnings,
    };
  }

  /**
   * Aplica una optimizacion guardando routePosition en las ordenes
   */
  async applyOptimization(
    optimizedOrderIds: string[],
    startTime: string = '09:00',
  ): Promise<{ applied: number }> {
    const etas = this.calculateETAs(optimizedOrderIds, startTime);

    let applied = 0;
    for (let i = 0; i < optimizedOrderIds.length; i++) {
      const orderId = optimizedOrderIds[i];
      const eta = etas.find((e) => e.orderId === orderId);

      await this.orderRepository.update(orderId, {
        routePosition: i + 1,
        estimatedArrivalStart: eta?.etaStart,
        estimatedArrivalEnd: eta?.etaEnd,
      });
      applied++;
    }

    return { applied };
  }

  // Helpers privados
  private parseStartTime(startTime: string): Date {
    const [hours, minutes] = startTime.split(':').map(Number);
    const date = new Date();
    date.setHours(hours || 9, minutes || 0, 0, 0);
    return date;
  }

  private createOptimizationLeg(
    order: Order,
    position: number,
    currentTime: Date,
    distanceKm: number,
    durationMinutes: number,
  ): OptimizationLeg {
    const etaStart = new Date(currentTime);
    const etaEnd = new Date(currentTime.getTime() + durationMinutes * 60000);

    const address = order.addressRaw
      ? `${order.addressRaw.street || ''} ${order.addressRaw.number || ''}, ${order.addressRaw.neighborhood || ''}`
      : 'Sin direccion';

    return {
      orderId: order.id,
      position,
      distanceKm: Math.round(distanceKm * 10) / 10,
      durationMinutes: Math.round(durationMinutes),
      etaStart: etaStart.toISOString(),
      etaEnd: etaEnd.toISOString(),
      clientName: order.clientName,
      address: address.trim().replace(/^,\s*/, '').replace(/,\s*$/, ''),
      priority: order.priorityLevel,
    };
  }
}
