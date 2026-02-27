import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, ILike } from 'typeorm';

import { PickupPoint } from './entities/pickup-point.entity';
import { RouteStop } from './entities/route-stop.entity';
import { StopType, RouteStopStatus } from '@/common/enums';
import {
  CreatePickupPointDto,
  UpdatePickupPointDto,
  CreateRouteStopDto,
  CompleteRouteStopDto,
} from './dto';
import { StorageService } from '@/modules/storage/storage.service';

@Injectable()
export class RouteStopsService {
  private readonly logger = new Logger(RouteStopsService.name);

  constructor(
    @InjectRepository(PickupPoint)
    private readonly pickupPointRepo: Repository<PickupPoint>,
    @InjectRepository(RouteStop)
    private readonly routeStopRepo: Repository<RouteStop>,
    private readonly storageService: StorageService,
  ) {}

  // ── Pickup Points ────────────────────────────────────────

  async createPickupPoint(dto: CreatePickupPointDto): Promise<PickupPoint> {
    const point = this.pickupPointRepo.create({
      clientId: dto.clientId || null,
      clientName: dto.clientName,
      contactName: dto.contactName || null,
      contactPhone: dto.contactPhone || null,
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
    });

    const saved = await this.pickupPointRepo.save(point);
    this.logger.log(`Created pickup point ${saved.id} for client "${dto.clientName}"`);
    return saved;
  }

  async updatePickupPoint(id: string, dto: UpdatePickupPointDto): Promise<PickupPoint> {
    const point = await this.pickupPointRepo.findOne({ where: { id } });
    if (!point) throw new NotFoundException('Punto de recolección no encontrado');

    Object.assign(point, dto);
    return this.pickupPointRepo.save(point);
  }

  async findAllPickupPoints(clientId?: string): Promise<PickupPoint[]> {
    const where: any = { isActive: true };
    if (clientId) where.clientId = clientId;

    return this.pickupPointRepo.find({
      where,
      order: { useCount: 'DESC', clientName: 'ASC' },
    });
  }

  async searchPickupPoints(query: string): Promise<PickupPoint[]> {
    return this.pickupPointRepo.find({
      where: [
        { clientName: ILike(`%${query}%`), isActive: true },
        { label: ILike(`%${query}%`), isActive: true },
        { street: ILike(`%${query}%`), isActive: true },
        { neighborhood: ILike(`%${query}%`), isActive: true },
      ],
      order: { useCount: 'DESC' },
      take: 20,
    });
  }

  async deletePickupPoint(id: string): Promise<void> {
    const point = await this.pickupPointRepo.findOne({ where: { id } });
    if (!point) throw new NotFoundException('Punto de recolección no encontrado');

    // Soft delete: mark as inactive
    point.isActive = false;
    await this.pickupPointRepo.save(point);
    this.logger.log(`Deactivated pickup point ${id}`);
  }

  // ── Route Stops ──────────────────────────────────────────

  async createRouteStop(dto: CreateRouteStopDto): Promise<RouteStop> {
    const stop = this.routeStopRepo.create({
      stopType: dto.stopType,
      status: RouteStopStatus.PENDING,
      clientName: dto.clientName,
      clientId: dto.clientId || null,
      contactName: dto.contactName || null,
      contactPhone: dto.contactPhone || null,
      description: dto.description || null,
      itemsDescription: dto.itemsDescription || null,
      internalNotes: dto.internalNotes || null,
    });

    // If referencing a saved pickup point, copy its address
    if (dto.pickupPointId) {
      const point = await this.pickupPointRepo.findOne({
        where: { id: dto.pickupPointId, isActive: true },
      });
      if (!point) throw new BadRequestException('Punto de recolección no encontrado');

      stop.pickupPointId = point.id;
      stop.clientName = point.clientName;
      stop.clientId = point.clientId;
      stop.contactName = point.contactName;
      stop.contactPhone = point.contactPhone;
      stop.addressRaw = {
        street: point.street || undefined,
        number: point.number || undefined,
        neighborhood: point.neighborhood || undefined,
        postalCode: point.postalCode || undefined,
        city: point.city || undefined,
        state: point.state || undefined,
        reference: point.reference || undefined,
      };
      stop.latitude = point.latitude;
      stop.longitude = point.longitude;

      // Increment use count
      await this.pickupPointRepo.update(point.id, {
        useCount: () => 'use_count + 1',
        lastUsedAt: new Date(),
      });
    } else {
      // Manual address
      stop.addressRaw = dto.addressRaw || null;
      stop.latitude = dto.latitude || null;
      stop.longitude = dto.longitude || null;

      // Auto-save as pickup point for reuse (avoid re-filling fields next time)
      if (dto.addressRaw && dto.clientName) {
        const autoPoint = this.pickupPointRepo.create({
          clientId: dto.clientId || null,
          clientName: dto.clientName,
          contactName: dto.contactName || null,
          contactPhone: dto.contactPhone || null,
          label: dto.stopType === 'DOCUMENTATION' ? 'Documentación' : 'Recolección',
          street: dto.addressRaw.street || null,
          number: dto.addressRaw.number || null,
          neighborhood: dto.addressRaw.neighborhood || null,
          postalCode: dto.addressRaw.postalCode || null,
          city: dto.addressRaw.city || null,
          state: dto.addressRaw.state || null,
          reference: dto.addressRaw.reference || null,
          latitude: dto.latitude || null,
          longitude: dto.longitude || null,
        });
        const savedPoint = await this.pickupPointRepo.save(autoPoint);
        stop.pickupPointId = savedPoint.id;
        this.logger.log(`Auto-saved pickup point ${savedPoint.id} for "${dto.clientName}"`);
      }
    }

    const saved = await this.routeStopRepo.save(stop);
    this.logger.log(`Created route stop ${saved.id} (${dto.stopType}) for "${dto.clientName}"`);
    return saved;
  }

  async getRouteStopsByDriver(driverId: string): Promise<RouteStop[]> {
    return this.routeStopRepo.find({
      where: {
        assignedDriverId: driverId,
        status: In([RouteStopStatus.IN_TRANSIT]),
      },
      order: { routePosition: 'ASC' },
    });
  }

  async getPendingRouteStops(): Promise<RouteStop[]> {
    return this.routeStopRepo.find({
      where: { status: RouteStopStatus.PENDING },
      order: { createdAt: 'ASC' },
    });
  }

  async getRouteStopById(id: string): Promise<RouteStop> {
    const stop = await this.routeStopRepo.findOne({ where: { id } });
    if (!stop) throw new NotFoundException('Parada no encontrada');
    return stop;
  }

  async completeRouteStop(
    id: string,
    driverId: string,
    dto: CompleteRouteStopDto,
  ): Promise<RouteStop> {
    const stop = await this.routeStopRepo.findOne({ where: { id } });
    if (!stop) throw new NotFoundException('Parada no encontrada');

    if (stop.status !== RouteStopStatus.IN_TRANSIT) {
      throw new BadRequestException('Solo se pueden completar paradas en tránsito');
    }

    // Upload photo if provided
    let photoKey: string | null = null;
    if (dto.base64Photo) {
      photoKey = await this.storageService.saveBase64File(
        dto.base64Photo,
        'route-stop',
        id,
      );
    }

    stop.status = RouteStopStatus.COMPLETED;
    stop.completedAt = new Date();
    stop.completedBy = driverId;
    stop.completionNotes = dto.completionNotes || null;
    if (photoKey) stop.completionPhotoKey = photoKey;

    const saved = await this.routeStopRepo.save(stop);
    this.logger.log(`Completed route stop ${id} by driver ${driverId}`);
    return saved;
  }

  async cancelRouteStop(id: string): Promise<RouteStop> {
    const stop = await this.routeStopRepo.findOne({ where: { id } });
    if (!stop) throw new NotFoundException('Parada no encontrada');

    if (stop.status === RouteStopStatus.COMPLETED) {
      throw new BadRequestException('No se puede cancelar una parada completada');
    }

    stop.status = RouteStopStatus.CANCELLED;
    return this.routeStopRepo.save(stop);
  }

  async dispatchStops(stopIds: string[], driverId: string): Promise<number> {
    const stops = await this.routeStopRepo.find({
      where: { id: In(stopIds) },
    });

    let dispatched = 0;
    for (const stop of stops) {
      if (stop.status === RouteStopStatus.PENDING) {
        stop.status = RouteStopStatus.IN_TRANSIT;
        stop.assignedDriverId = driverId;
        await this.routeStopRepo.save(stop);
        dispatched++;
      }
    }

    this.logger.log(`Dispatched ${dispatched} route stops to driver ${driverId}`);
    return dispatched;
  }

  /**
   * Get route stops by IDs (for route optimization)
   */
  async getRouteStopsByIds(ids: string[]): Promise<RouteStop[]> {
    if (ids.length === 0) return [];
    return this.routeStopRepo.find({ where: { id: In(ids) } });
  }

  /**
   * Update route position and ETAs for a stop
   */
  async updateStopRouteInfo(
    id: string,
    routePosition: number,
    etaStart: Date,
    etaEnd: Date,
  ): Promise<void> {
    await this.routeStopRepo.update(id, {
      routePosition,
      estimatedArrivalStart: etaStart,
      estimatedArrivalEnd: etaEnd,
    });
  }

  /**
   * Get active (IN_TRANSIT) route stops grouped by driver
   */
  async getActiveStopsByDriver(): Promise<Map<string, RouteStop[]>> {
    const stops = await this.routeStopRepo.find({
      where: { status: RouteStopStatus.IN_TRANSIT },
      order: { routePosition: 'ASC' },
    });

    const map = new Map<string, RouteStop[]>();
    for (const stop of stops) {
      const driverId = stop.assignedDriverId || 'unassigned';
      if (!map.has(driverId)) map.set(driverId, []);
      map.get(driverId)!.push(stop);
    }
    return map;
  }
}
