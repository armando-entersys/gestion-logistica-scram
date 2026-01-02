import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

import { Order, ShipmentEvidence } from './entities';
import { OrderStatus, PriorityLevel, EvidenceType, UserRole } from '@/common/enums';
import {
  CreateOrderDto,
  DispatchRouteDto,
  AssignDriverDto,
  UpdateLocationDto,
  SubmitCsatDto,
  OrderFilterDto,
} from './dto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(ShipmentEvidence)
    private readonly evidenceRepository: Repository<ShipmentEvidence>,
    @InjectQueue('notifications')
    private readonly notificationQueue: Queue,
    private readonly configService: ConfigService,
  ) {}

  /**
   * RF-01: Sincronización Controlada con Bind ERP
   * Lógica de upsert usando bind_id como llave de idempotencia
   */
  async syncWithBind(bindOrders: CreateOrderDto[]): Promise<{
    created: number;
    updated: number;
    errors: Array<{ bindId: string; error: string }>;
  }> {
    let created = 0;
    let updated = 0;
    const errors: Array<{ bindId: string; error: string }> = [];

    for (const bindOrder of bindOrders) {
      try {
        const existingOrder = await this.orderRepository.findOne({
          where: { bindId: bindOrder.bindId },
        });

        if (existingOrder) {
          await this.orderRepository.update(existingOrder.id, {
            clientName: bindOrder.clientName,
            clientEmail: bindOrder.clientEmail,
            clientPhone: bindOrder.clientPhone,
            clientRfc: bindOrder.clientRfc,
            addressRaw: bindOrder.addressRaw,
            totalAmount: bindOrder.totalAmount,
            isVip: bindOrder.isVip,
            promisedDate: bindOrder.promisedDate,
          });
          updated++;
        } else {
          const priorityLevel = this.calculatePriority(bindOrder);
          const trackingHash = this.generateTrackingHash();

          const newOrder = this.orderRepository.create({
            ...bindOrder,
            priorityLevel,
            trackingHash,
            status: OrderStatus.DRAFT,
          });

          await this.orderRepository.save(newOrder);
          created++;
        }
      } catch (error) {
        this.logger.error(`Error syncing order ${bindOrder.bindId}:`, error);
        errors.push({
          bindId: bindOrder.bindId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    this.logger.log(`Sync completed: ${created} created, ${updated} updated, ${errors.length} errors`);
    return { created, updated, errors };
  }

  /**
   * RF-02: Motor de Priorización Inteligente
   */
  private calculatePriority(order: CreateOrderDto): PriorityLevel {
    const thresholdAmount = this.configService.get<number>('business.priorityThresholdAmount') || 50000;

    // Prioridad CRÍTICA: VIP o fecha pasada
    if (order.isVip) {
      return PriorityLevel.CRITICAL;
    }

    if (order.promisedDate) {
      const promisedDate = new Date(order.promisedDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (promisedDate < today) {
        return PriorityLevel.CRITICAL;
      }
    }

    // Prioridad ALTA: Monto superior al umbral
    if (order.totalAmount && order.totalAmount > thresholdAmount) {
      return PriorityLevel.HIGH;
    }

    return PriorityLevel.NORMAL;
  }

  private generateTrackingHash(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * RF-01: Liberar pedidos a Tráfico (DRAFT -> READY)
   * Solo PURCHASING puede ejecutar esta acción
   */
  async releaseToTraffic(orderIds: string[]): Promise<{ released: number }> {
    const result = await this.orderRepository.update(
      {
        id: In(orderIds),
        status: OrderStatus.DRAFT,
      },
      { status: OrderStatus.READY },
    );

    this.logger.log(`Released ${result.affected} orders to traffic`);
    return { released: result.affected || 0 };
  }

  /**
   * RF-03: Asignación de Recursos y Gestión de Flota
   */
  async assignDriver(dto: AssignDriverDto): Promise<{ assigned: number; warning?: string }> {
    const maxOrdersPerDriver = this.configService.get<number>('business.maxOrdersPerDriver') || 15;

    const existingCount = await this.orderRepository.count({
      where: {
        assignedDriverId: dto.driverId,
        status: In([OrderStatus.READY, OrderStatus.IN_TRANSIT]),
      },
    });

    const totalAfterAssign = existingCount + dto.orderIds.length;
    let warning: string | undefined;

    if (totalAfterAssign > maxOrdersPerDriver) {
      warning = `Advertencia: El chofer ha superado la carga recomendada (${totalAfterAssign}/${maxOrdersPerDriver} pedidos). ¿Desea continuar?`;
    }

    await this.orderRepository.update(
      { id: In(dto.orderIds) },
      {
        assignedDriverId: dto.driverId,
        status: OrderStatus.READY,
      },
    );

    return { assigned: dto.orderIds.length, warning };
  }

  /**
   * RF-12 / CU-06: Despacho de Ruta con Notificación ETA
   */
  async dispatchRoute(dto: DispatchRouteDto): Promise<{
    dispatched: number;
    emailsQueued: number;
  }> {
    const startTime = dto.startTime || this.configService.get('business.defaultRouteStartTime') || '09:00';
    const avgStopTime = this.configService.get<number>('business.averageStopTimeMinutes') || 30;
    const bufferPercent = this.configService.get<number>('business.trafficBufferPercent') || 15;

    const orders = await this.orderRepository.find({
      where: { id: In(dto.orderIds) },
    });

    if (orders.length !== dto.orderIds.length) {
      throw new BadRequestException('Algunos pedidos no fueron encontrados');
    }

    let emailsQueued = 0;

    for (let i = 0; i < dto.orderIds.length; i++) {
      const orderId = dto.orderIds[i];
      const order = orders.find((o) => o.id === orderId);
      if (!order) continue;

      const position = i + 1;

      // Calcular ventana ETA
      const [hours, minutes] = startTime.split(':').map(Number);
      const baseTime = new Date();
      baseTime.setHours(hours, minutes, 0, 0);

      const minutesToAdd = i * avgStopTime;
      const bufferMinutes = Math.ceil(minutesToAdd * (bufferPercent / 100));

      const etaStart = new Date(baseTime.getTime() + minutesToAdd * 60000);
      const etaEnd = new Date(etaStart.getTime() + (avgStopTime + bufferMinutes) * 60000);

      await this.orderRepository.update(orderId, {
        status: OrderStatus.IN_TRANSIT,
        routePosition: position,
        estimatedArrivalStart: etaStart,
        estimatedArrivalEnd: etaEnd,
        assignedDriverId: dto.driverId,
      });

      // Encolar email de notificación
      if (order.clientEmail && !order.dispatchEmailSent) {
        await this.notificationQueue.add(
          'send-eta-email',
          {
            orderId,
            clientEmail: order.clientEmail,
            clientName: order.clientName,
            driverId: dto.driverId,
            etaStart: etaStart.toISOString(),
            etaEnd: etaEnd.toISOString(),
            trackingHash: order.trackingHash,
            routePosition: position,
          },
          {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
          },
        );

        await this.orderRepository.update(orderId, { dispatchEmailSent: true });
        emailsQueued++;
      }
    }

    this.logger.log(`Route dispatched: ${dto.orderIds.length} orders, ${emailsQueued} emails queued`);
    return { dispatched: dto.orderIds.length, emailsQueued };
  }

  /**
   * RF-04: Prueba de Entrega (POD)
   * DRIVER solo puede marcar pedidos asignados a él
   */
  async markAsDelivered(
    orderId: string,
    evidenceData?: { type: EvidenceType; storageKey: string; isOffline?: boolean },
    driverId?: string,
  ): Promise<Order> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`Pedido ${orderId} no encontrado`);
    }

    // Validar que el chofer solo puede entregar sus pedidos asignados
    if (driverId && order.assignedDriverId !== driverId) {
      throw new ForbiddenException('No tienes permiso para marcar este pedido como entregado');
    }

    const now = new Date();
    const trackingExpires = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    await this.orderRepository.update(orderId, {
      status: OrderStatus.DELIVERED,
      deliveredAt: now,
      trackingExpiresAt: trackingExpires,
    });

    if (evidenceData) {
      const evidence = this.evidenceRepository.create({
        orderId,
        type: evidenceData.type,
        storageKey: evidenceData.storageKey,
        isOfflineUpload: evidenceData.isOffline || false,
        capturedAt: now,
      });
      await this.evidenceRepository.save(evidence);
    }

    // Encolar email de confirmación + encuesta CSAT
    await this.notificationQueue.add(
      'send-delivery-confirmation',
      {
        orderId,
        clientEmail: order.clientEmail,
        clientName: order.clientName,
        trackingHash: order.trackingHash,
      },
      {
        delay: 5000,
        attempts: 3,
      },
    );

    return this.orderRepository.findOne({ where: { id: orderId } }) as Promise<Order>;
  }

  /**
   * RF-05: Encuesta de Satisfacción (CSAT)
   */
  async submitCsatScore(trackingHash: string, dto: SubmitCsatDto): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { trackingHash },
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }

    if (order.trackingExpiresAt && new Date() > order.trackingExpiresAt) {
      throw new BadRequestException('El enlace de la encuesta ha expirado');
    }

    await this.orderRepository.update(order.id, {
      csatScore: dto.score,
      csatFeedback: dto.feedback,
    });

    // Alerta de detractor (calificación 1-2 estrellas)
    if (dto.score <= 2) {
      await this.notificationQueue.add(
        'send-detractor-alert',
        {
          orderId: order.id,
          score: dto.score,
          feedback: dto.feedback,
          clientName: order.clientName,
        },
        { priority: 1 },
      );
    }
  }

  /**
   * RF-03: Resiliencia Geográfica - Corrección manual del pin
   */
  async updateLocation(dto: UpdateLocationDto): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: dto.orderId },
    });

    if (!order) {
      throw new NotFoundException(`Pedido ${dto.orderId} no encontrado`);
    }

    await this.orderRepository.update(dto.orderId, {
      latitude: dto.latitude,
      longitude: dto.longitude,
      addressGeo: () => `ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326)`,
    });

    return this.orderRepository.findOne({ where: { id: dto.orderId } }) as Promise<Order>;
  }

  /**
   * RF-09: Portal de Visibilidad - Agregar nota interna
   */
  async addInternalNote(orderId: string, note: string, user: any): Promise<Order> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`Pedido ${orderId} no encontrado`);
    }

    const timestamp = new Date().toISOString();
    const newNote = `[${timestamp}] ${user.firstName} ${user.lastName}: ${note}`;
    const existingNotes = order.internalNotes || '';
    const updatedNotes = existingNotes ? `${existingNotes}\n${newNote}` : newNote;

    await this.orderRepository.update(orderId, { internalNotes: updatedNotes });
    return this.orderRepository.findOne({ where: { id: orderId } }) as Promise<Order>;
  }

  /**
   * RF-09: Portal de Visibilidad - Listar pedidos con filtros
   */
  async findAll(filters: OrderFilterDto): Promise<{
    data: Order[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.orderRepository.createQueryBuilder('order');

    if (filters.status) {
      queryBuilder.andWhere('order.status = :status', { status: filters.status });
    }

    if (filters.priorityLevel) {
      queryBuilder.andWhere('order.priorityLevel = :priorityLevel', {
        priorityLevel: filters.priorityLevel,
      });
    }

    if (filters.driverId) {
      queryBuilder.andWhere('order.assignedDriverId = :driverId', {
        driverId: filters.driverId,
      });
    }

    if (filters.search) {
      queryBuilder.andWhere(
        '(order.clientName ILIKE :search OR order.clientRfc ILIKE :search OR order.bindId ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    queryBuilder
      .orderBy('order.priorityLevel', 'DESC')
      .addOrderBy('order.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();
    return { data, total, page, limit };
  }

  /**
   * Get single order - validación según rol
   * DRIVER: solo puede ver sus pedidos asignados (sin montos)
   */
  async findOne(id: string, user?: any): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['assignedDriver', 'evidences'],
    });

    if (!order) {
      throw new NotFoundException(`Pedido ${id} no encontrado`);
    }

    // DRIVER solo puede ver sus pedidos asignados
    if (user?.roleCode === UserRole.DRIVER) {
      if (order.assignedDriverId !== user.id) {
        throw new ForbiddenException('No tienes permiso para ver este pedido');
      }
      // Ocultar monto para choferes (restricción de seguridad del MD050)
      order.totalAmount = 0;
    }

    return order;
  }

  /**
   * Tracking público por hash (Cliente Final)
   */
  async findByTrackingHash(hash: string): Promise<Order | null> {
    const order = await this.orderRepository.findOne({
      where: { trackingHash: hash },
      select: [
        'id',
        'clientName',
        'status',
        'estimatedArrivalStart',
        'estimatedArrivalEnd',
        'routePosition',
        'deliveredAt',
        'trackingExpiresAt',
      ],
    });

    if (!order) {
      return null;
    }

    if (order.trackingExpiresAt && new Date() > order.trackingExpiresAt) {
      return null;
    }

    return order;
  }

  /**
   * Ruta del chofer (solo sus pedidos asignados)
   */
  async getDriverRoute(driverId: string): Promise<Partial<Order>[]> {
    const orders = await this.orderRepository.find({
      where: {
        assignedDriverId: driverId,
        status: In([OrderStatus.READY, OrderStatus.IN_TRANSIT]),
      },
      order: { routePosition: 'ASC' },
      select: [
        'id',
        'bindId',
        'clientName',
        'clientPhone',
        'addressRaw',
        'latitude',
        'longitude',
        'status',
        'priorityLevel',
        'routePosition',
        'estimatedArrivalStart',
        'estimatedArrivalEnd',
        // NO incluye totalAmount (restricción MD050)
      ],
    });

    return orders;
  }

  /**
   * Dashboard statistics (ADMIN, DIRECTOR)
   */
  async getDashboardStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    avgCsat: number | null;
    todayDelivered: number;
    todayPending: number;
  }> {
    const total = await this.orderRepository.count();

    const statusCounts = await this.orderRepository
      .createQueryBuilder('order')
      .select('order.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('order.status')
      .getRawMany();

    const priorityCounts = await this.orderRepository
      .createQueryBuilder('order')
      .select('order.priorityLevel', 'priority')
      .addSelect('COUNT(*)', 'count')
      .groupBy('order.priorityLevel')
      .getRawMany();

    const csatResult = await this.orderRepository
      .createQueryBuilder('order')
      .select('AVG(order.csatScore)', 'avg')
      .where('order.csatScore IS NOT NULL')
      .getRawOne();

    // Estadísticas del día
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayDelivered = await this.orderRepository.count({
      where: {
        status: OrderStatus.DELIVERED,
      },
    });

    const todayPending = await this.orderRepository.count({
      where: {
        status: In([OrderStatus.READY, OrderStatus.IN_TRANSIT]),
      },
    });

    const byStatus: Record<string, number> = {};
    for (const item of statusCounts) {
      byStatus[item.status] = parseInt(item.count, 10);
    }

    const byPriority: Record<string, number> = {};
    for (const item of priorityCounts) {
      byPriority[item.priority] = parseInt(item.count, 10);
    }

    return {
      total,
      byStatus,
      byPriority,
      avgCsat: csatResult?.avg ? parseFloat(csatResult.avg) : null,
      todayDelivered,
      todayPending,
    };
  }
}
