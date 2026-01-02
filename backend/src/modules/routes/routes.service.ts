import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '@/common/enums';

@Injectable()
export class RoutesService {
  private readonly logger = new Logger(RoutesService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly configService: ConfigService,
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
}
