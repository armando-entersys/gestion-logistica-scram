import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

import { Order, ShipmentEvidence } from './entities';
import { AddressChangeRequest, AddressChangeStatus } from './entities/address-change-request.entity';
import { OrderStatus, PriorityLevel, EvidenceType, UserRole, CarrierType, OrderSource } from '@/common/enums';
import {
  CreateOrderDto,
  DispatchRouteDto,
  AssignDriverDto,
  AssignCarrierDto,
  UpdateLocationDto,
  UpdateAddressDto,
  SubmitCsatDto,
  OrderFilterDto,
  RequestAddressChangeDto,
  RespondAddressChangeDto,
  ReturnOrderDto,
  ConfirmPickupDto,
} from './dto';
import { GeocodingService } from '@/common/services/geocoding.service';
import { ClientAddressesService } from '@/modules/client-addresses/client-addresses.service';
import { ClientsService } from '@/modules/clients/clients.service';
import { PushSubscriptionsService } from '@/modules/push-subscriptions/push-subscriptions.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(ShipmentEvidence)
    private readonly evidenceRepository: Repository<ShipmentEvidence>,
    @InjectRepository(AddressChangeRequest)
    private readonly addressChangeRepository: Repository<AddressChangeRequest>,
    @InjectQueue('notifications')
    private readonly notificationQueue: Queue,
    private readonly configService: ConfigService,
    private readonly geocodingService: GeocodingService,
    private readonly clientAddressesService: ClientAddressesService,
    private readonly clientsService: ClientsService,
    private readonly pushService: PushSubscriptionsService,
  ) {}

  /**
   * Busca un pedido por número de pedido (ej: 4880 para PE4880)
   */
  async findByOrderNumber(orderNumber: number): Promise<Order | null> {
    // El orderNumber en la BD es como "PE4880", buscamos con LIKE
    return this.orderRepository.findOne({
      where: [
        { orderNumber: `PE${orderNumber}` },
        { orderNumber: `${orderNumber}` },
      ],
    });
  }

  /**
   * Obtiene los bind_id de todos los pedidos existentes en la BD
   * Usado para sync diferencial - evita re-sincronizar pedidos que ya existen
   */
  async getExistingBindIds(): Promise<Set<string>> {
    const result = await this.orderRepository
      .createQueryBuilder('order')
      .select('order.bind_id', 'bindId')
      .where('order.bind_id IS NOT NULL')
      .getRawMany();

    return new Set(result.map(r => r.bindId));
  }

  /**
   * RF-01: Sincronización Controlada con Bind ERP
   * Lógica de upsert usando bind_id como llave de idempotencia
   */
  async syncWithBind(bindOrders: CreateOrderDto[]): Promise<{
    created: number;
    updated: number;
    geocoded: number;
    errors: Array<{ bindId: string; error: string }>;
  }> {
    let created = 0;
    let updated = 0;
    let geocoded = 0;
    const errors: Array<{ bindId: string; error: string }> = [];

    for (const bindOrder of bindOrders) {
      try {
        const existingOrder = await this.orderRepository.findOne({
          where: { bindId: bindOrder.bindId },
        });

        // Create or update client record for ALL orders (new and existing)
        let clientId: string | null = null;
        if (bindOrder.clientNumber) {
          this.logger.log(`Upserting client ${bindOrder.clientNumber} for order ${bindOrder.bindId}`);
          try {
            const client = await this.clientsService.upsertClient({
              clientNumber: bindOrder.clientNumber,
              name: bindOrder.clientName,
              email: bindOrder.clientEmail,
              phone: bindOrder.clientPhone,
              rfc: bindOrder.clientRfc,
              isVip: bindOrder.isVip,
            }, 'SYNC');
            clientId = client.id;
            this.logger.log(`Client upserted: ${client.id} - ${client.clientNumber}`);
          } catch (clientError) {
            this.logger.error(`Failed to upsert client for order ${bindOrder.bindId}: ${clientError.message}`, clientError.stack);
          }
        } else {
          this.logger.warn(`Order ${bindOrder.bindId} has no clientNumber`);
        }

        // Save address to client address book for ALL orders (new and existing)
        if (bindOrder.clientNumber && bindOrder.addressRaw?.street) {
          try {
            await this.clientAddressesService.upsertAddress({
              clientNumber: bindOrder.clientNumber,
              street: bindOrder.addressRaw.street,
              number: bindOrder.addressRaw.number,
              neighborhood: bindOrder.addressRaw.neighborhood,
              postalCode: bindOrder.addressRaw.postalCode,
              city: bindOrder.addressRaw.city,
              state: bindOrder.addressRaw.state,
              reference: bindOrder.addressRaw.reference,
            }, 'SYNC', bindOrder.bindId);
            this.logger.log(`Saved address for client ${bindOrder.clientNumber}`);
          } catch (addrError) {
            this.logger.warn(`Failed to save client address for order ${bindOrder.bindId}: ${addrError.message}`);
          }
        }

        if (existingOrder) {
          // Base update data for all existing orders
          const updateData: Partial<Order> = {
            orderNumber: bindOrder.orderNumber,
            warehouseName: bindOrder.warehouseName,
            employeeName: bindOrder.employeeName,
            clientNumber: bindOrder.clientNumber,
            clientId: clientId,
            bindClientId: bindOrder.bindClientId, // UUID del cliente en Bind para sincronizar direcciones
            purchaseOrder: bindOrder.purchaseOrder,
            clientName: bindOrder.clientName,
            clientEmail: bindOrder.clientEmail,
            clientPhone: bindOrder.clientPhone,
            clientRfc: bindOrder.clientRfc,
            totalAmount: bindOrder.totalAmount,
            isVip: bindOrder.isVip,
            promisedDate: bindOrder.promisedDate,
          };

          // Only update addressRaw if order is still in DRAFT status
          // This protects addresses edited in traffic panel
          if (existingOrder.status === OrderStatus.DRAFT && bindOrder.addressRaw) {
            updateData.addressRaw = bindOrder.addressRaw as Order['addressRaw'];
          } else if (existingOrder.status !== OrderStatus.DRAFT) {
            this.logger.log(`Skipping address update for order ${bindOrder.bindId} (status: ${existingOrder.status})`);
          }

          await this.orderRepository.update(existingOrder.id, updateData);
          updated++;
        } else {
          const priorityLevel = this.calculatePriority(bindOrder);
          const trackingHash = this.generateTrackingHash();

          // Geocodificar dirección para nuevos pedidos
          let latitude: number | null = null;
          let longitude: number | null = null;

          if (bindOrder.addressRaw) {
            const geoResult = await this.geocodingService.geocodeAddress(bindOrder.addressRaw);
            if (geoResult) {
              latitude = geoResult.latitude;
              longitude = geoResult.longitude;
              geocoded++;
              this.logger.log(`Geocoded order ${bindOrder.bindId}: ${latitude}, ${longitude}`);
            }
          }

          const newOrder = this.orderRepository.create({
            ...bindOrder,
            clientId,
            priorityLevel,
            trackingHash,
            status: OrderStatus.DRAFT,
            latitude,
            longitude,
          });

          await this.orderRepository.save(newOrder);
          created++;

          // Update client order stats (only for new orders)
          if (bindOrder.clientNumber) {
            try {
              await this.clientsService.incrementOrderStats(
                bindOrder.clientNumber,
                bindOrder.totalAmount || 0,
              );
            } catch (statsError) {
              this.logger.warn(`Failed to update client stats for order ${bindOrder.bindId}: ${statsError.message}`);
            }
          }
        }
      } catch (error) {
        this.logger.error(`Error syncing order ${bindOrder.bindId}:`, error);
        errors.push({
          bindId: bindOrder.bindId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    this.logger.log(`Sync completed: ${created} created, ${updated} updated, ${geocoded} geocoded, ${errors.length} errors`);
    return { created, updated, geocoded, errors };
  }

  /**
   * Geocodifica pedidos existentes que no tienen coordenadas
   */
  async geocodePendingOrders(): Promise<{ geocoded: number; failed: number }> {
    const ordersWithoutCoords = await this.orderRepository.find({
      where: {
        latitude: IsNull(),
        status: In([OrderStatus.DRAFT, OrderStatus.READY]),
      },
      take: 50, // Procesar en batches para evitar timeout
    });

    this.logger.log(`Found ${ordersWithoutCoords.length} orders without coordinates`);

    let geocoded = 0;
    let failed = 0;

    for (const order of ordersWithoutCoords) {
      try {
        if (!order.addressRaw) {
          failed++;
          continue;
        }

        const geoResult = await this.geocodingService.geocodeAddress(order.addressRaw);

        if (geoResult) {
          await this.orderRepository.update(order.id, {
            latitude: geoResult.latitude,
            longitude: geoResult.longitude,
            addressGeo: () => `ST_SetSRID(ST_MakePoint(${geoResult.longitude}, ${geoResult.latitude}), 4326)`,
          });
          geocoded++;
          this.logger.log(`Geocoded order ${order.bindId}: ${geoResult.latitude}, ${geoResult.longitude}`);
        } else {
          failed++;
        }

        // Pequeño delay para evitar rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        this.logger.error(`Error geocoding order ${order.bindId}:`, error);
        failed++;
      }
    }

    this.logger.log(`Geocoding completed: ${geocoded} geocoded, ${failed} failed`);
    return { geocoded, failed };
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
   * Revertir pedidos de Tráfico a Compras (READY -> DRAFT)
   * Solo pedidos en READY pueden ser revertidos (no IN_TRANSIT ni DELIVERED)
   */
  async revertToDraft(orderIds: string[]): Promise<{ reverted: number }> {
    const result = await this.orderRepository.update(
      {
        id: In(orderIds),
        status: OrderStatus.READY,
      },
      {
        status: OrderStatus.DRAFT,
        assignedDriverId: null,
        routePosition: null,
      },
    );

    this.logger.log(`Reverted ${result.affected} orders back to draft`);
    return { reverted: result.affected || 0 };
  }

  /**
   * Eliminar pedidos en DRAFT por IDs
   * PURCHASING y ADMIN pueden ejecutar esta acción
   * Solo se eliminan pedidos en estado DRAFT
   */
  async deleteDraftOrders(orderIds: string[]): Promise<{ deleted: number }> {
    this.logger.log(`Delete request for ${orderIds.length} orders: ${orderIds.join(', ')}`);

    // Verificar cuántos existen y en qué status están
    const existingOrders = await this.orderRepository.find({
      where: { id: In(orderIds) },
      select: ['id', 'status', 'orderNumber'],
    });

    this.logger.log(`Found ${existingOrders.length} orders in DB`);
    for (const order of existingOrders) {
      this.logger.log(`  - Order ${order.orderNumber || order.id}: status=${order.status}`);
    }

    const draftOrders = existingOrders.filter(o => o.status === OrderStatus.DRAFT);
    this.logger.log(`${draftOrders.length} orders are in DRAFT status`);

    if (draftOrders.length === 0) {
      this.logger.warn('No DRAFT orders to delete - orders may have different status');
      return { deleted: 0 };
    }

    // Eliminar solo los que están en DRAFT
    const draftIds = draftOrders.map(o => o.id);
    const result = await this.orderRepository.delete({
      id: In(draftIds),
    });

    this.logger.log(`Deleted ${result.affected} draft orders`);
    return { deleted: result.affected || 0 };
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
   * Asignar paquetería externa a pedidos
   * RF-03: Gestión de Flota - Paqueterías externas
   */
  async assignCarrier(dto: AssignCarrierDto): Promise<{ assigned: number }> {
    // Para tipo OTHER, validar que se proporcione nombre
    if (dto.carrierType === CarrierType.OTHER && !dto.carrierName) {
      throw new BadRequestException('Se requiere nombre del carrier para tipo OTHER');
    }

    const carrierName = dto.carrierType === CarrierType.OTHER
      ? dto.carrierName
      : this.getCarrierDisplayName(dto.carrierType);

    // Parsear fecha y hora de entrega si se proporcionan
    const deliveryDate = dto.deliveryDate ? new Date(dto.deliveryDate + 'T12:00:00') : null;
    const deliveryTime = dto.deliveryTime || null;

    await this.orderRepository.update(
      { id: In(dto.orderIds) },
      {
        carrierType: dto.carrierType,
        carrierName: carrierName,
        carrierTrackingNumber: dto.trackingNumber || null,
        carrierDeliveryDate: deliveryDate,
        carrierDeliveryTime: deliveryTime,
        status: OrderStatus.IN_TRANSIT, // Cambiar a En Ruta cuando se asigna paquetería
        assignedDriverId: null, // No hay chofer interno
      },
    );

    this.logger.log(`Assigned carrier ${dto.carrierType} to ${dto.orderIds.length} orders (deliveryDate: ${dto.deliveryDate}, deliveryTime: ${dto.deliveryTime})`);
    return { assigned: dto.orderIds.length };
  }

  /**
   * Obtener nombre de display del carrier
   */
  private getCarrierDisplayName(carrierType: CarrierType): string {
    const names: Record<CarrierType, string> = {
      [CarrierType.INTERNAL]: 'Chofer Interno',
      [CarrierType.PROVIDER]: 'Proveedor Directo',
      [CarrierType.FEDEX]: 'FedEx',
      [CarrierType.DHL]: 'DHL',
      [CarrierType.ESTAFETA]: 'Estafeta',
      [CarrierType.PAQUETE_EXPRESS]: 'Paquete Express',
      [CarrierType.REDPACK]: 'Redpack',
      [CarrierType.UPS]: 'UPS',
      [CarrierType.OTHER]: 'Otro',
    };
    return names[carrierType] || carrierType;
  }

  /**
   * RF-12 / CU-06: Despacho de Ruta con Notificación ETA
   */
  async dispatchRoute(dto: DispatchRouteDto): Promise<{
    dispatched: number;
    emailsQueued: number;
  }> {
    this.logger.log(`Dispatch request: driver=${dto.driverId}, orders=${dto.orderIds.length}, startTime=${dto.startTime}`);

    const startTime = dto.startTime || this.configService.get('business.defaultRouteStartTime') || '09:00';
    const avgStopTime = this.configService.get<number>('business.averageStopTimeMinutes') || 30;
    const bufferPercent = this.configService.get<number>('business.trafficBufferPercent') || 15;

    const orders = await this.orderRepository.find({
      where: { id: In(dto.orderIds) },
      relations: ['client'],
    });

    this.logger.log(`Found ${orders.length} orders for dispatch (requested: ${dto.orderIds.length})`);

    if (orders.length !== dto.orderIds.length) {
      const foundIds = orders.map(o => o.id);
      const missingIds = dto.orderIds.filter(id => !foundIds.includes(id));
      this.logger.warn(`Missing orders: ${missingIds.join(', ')}`);
      throw new BadRequestException(`Algunos pedidos no fueron encontrados: ${missingIds.join(', ')}`);
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

      // Generar trackingHash si no existe
      const trackingHash = order.trackingHash || this.generateTrackingHash();

      const updateResult = await this.orderRepository.update(orderId, {
        status: OrderStatus.IN_TRANSIT,
        routePosition: position,
        estimatedArrivalStart: etaStart,
        estimatedArrivalEnd: etaEnd,
        assignedDriverId: dto.driverId,
        trackingHash: trackingHash,
      });
      this.logger.log(`Updated order ${orderId} to IN_TRANSIT (affected: ${updateResult.affected})`);

      // Encolar email de notificación - usar email del cliente como fallback
      const recipientEmail = order.clientEmail || order.client?.email;
      if (recipientEmail && !order.dispatchEmailSent) {
        // Usar jobId único para evitar correos duplicados
        const jobId = `eta-${orderId}-${new Date().toISOString().split('T')[0]}`;
        await this.notificationQueue.add(
          'send-eta-email',
          {
            orderId,
            clientEmail: recipientEmail,
            clientName: order.clientName,
            driverId: dto.driverId,
            etaStart: etaStart.toISOString(),
            etaEnd: etaEnd.toISOString(),
            trackingHash: trackingHash,
            routePosition: position,
          },
          {
            jobId, // Previene duplicados con el mismo jobId
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
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['client'],
    });
    if (!order) {
      throw new NotFoundException(`Pedido ${orderId} no encontrado`);
    }

    // Validar que el chofer solo puede entregar sus pedidos asignados
    if (driverId && order.assignedDriverId !== driverId) {
      throw new ForbiddenException('No tienes permiso para marcar este pedido como entregado');
    }

    const now = new Date();
    const trackingExpires = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Generar trackingHash si no existe (para órdenes creadas antes de esta feature)
    const trackingHash = order.trackingHash || this.generateTrackingHash();

    await this.orderRepository.update(orderId, {
      status: OrderStatus.DELIVERED,
      deliveredAt: now,
      trackingExpiresAt: trackingExpires,
      trackingHash: trackingHash,
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

    // Encolar email de confirmación + encuesta CSAT - usar email del cliente como fallback
    const recipientEmail = order.clientEmail || order.client?.email;
    if (recipientEmail && !order.deliveryEmailSent) {
      // Usar jobId único para evitar correos duplicados
      const jobId = `delivery-${orderId}-${new Date().toISOString().split('T')[0]}`;
      await this.notificationQueue.add(
        'send-delivery-confirmation',
        {
          orderId,
          clientEmail: recipientEmail,
          clientName: order.clientName,
          trackingHash: trackingHash,
        },
        {
          jobId, // Previene duplicados con el mismo jobId
          delay: 5000,
          attempts: 3,
        },
      );

      await this.orderRepository.update(orderId, { deliveryEmailSent: true });
    }

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
   * Actualizar dirección de un pedido y re-geocodificar
   */
  async updateAddress(dto: UpdateAddressDto): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: dto.orderId },
    });

    if (!order) {
      throw new NotFoundException(`Pedido ${dto.orderId} no encontrado`);
    }

    // Update address
    const updateData: any = {
      addressRaw: dto.addressRaw,
    };

    // Geocode if requested (default true)
    if (dto.geocode !== false) {
      const geoResult = await this.geocodingService.geocodeAddress(dto.addressRaw);
      if (geoResult) {
        updateData.latitude = geoResult.latitude;
        updateData.longitude = geoResult.longitude;
        this.logger.log(`Geocoded updated address for order ${dto.orderId}: ${geoResult.latitude}, ${geoResult.longitude}`);
      }
    }

    await this.orderRepository.update(dto.orderId, updateData);

    // If we got coordinates, also update the geo column
    if (updateData.latitude && updateData.longitude) {
      await this.orderRepository.update(dto.orderId, {
        addressGeo: () => `ST_SetSRID(ST_MakePoint(${updateData.longitude}, ${updateData.latitude}), 4326)`,
      });
    }

    // Save address to client address book for future use
    if (order.clientNumber && dto.addressRaw?.street) {
      try {
        await this.clientAddressesService.upsertAddress({
          clientNumber: order.clientNumber,
          street: dto.addressRaw.street,
          number: dto.addressRaw.number,
          neighborhood: dto.addressRaw.neighborhood,
          postalCode: dto.addressRaw.postalCode,
          city: dto.addressRaw.city,
          state: dto.addressRaw.state,
          reference: dto.addressRaw.reference,
          latitude: updateData.latitude,
          longitude: updateData.longitude,
        }, 'MANUAL');
      } catch (addrError) {
        this.logger.warn(`Failed to save client address: ${addrError.message}`);
      }
    }

    return this.orderRepository.findOne({ where: { id: dto.orderId } }) as Promise<Order>;
  }

  /**
   * Actualizar fecha de pedido (promisedDate / F. Pedido)
   */
  async updatePromisedDate(dto: { orderId: string; promisedDate: string }): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: dto.orderId },
    });

    if (!order) {
      throw new NotFoundException(`Pedido ${dto.orderId} no encontrado`);
    }

    // Parse date string (YYYY-MM-DD) to Date object
    const dateValue = new Date(dto.promisedDate + 'T12:00:00');

    await this.orderRepository.update(dto.orderId, {
      promisedDate: dateValue,
    });

    this.logger.log(`Updated promisedDate for order ${dto.orderId} to ${dto.promisedDate}`);

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

    const queryBuilder = this.orderRepository.createQueryBuilder('order')
      .leftJoinAndSelect('order.assignedDriver', 'driver')
      .leftJoinAndSelect('order.evidences', 'evidence');

    if (filters.status) {
      const statuses = filters.status.split(',').map(s => s.trim());
      if (statuses.length === 1) {
        queryBuilder.andWhere('order.status = :status', { status: statuses[0] });
      } else {
        queryBuilder.andWhere('order.status IN (:...statuses)', { statuses });
      }
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
        'bindId',
        'orderNumber',
        'clientName',
        'addressRaw',
        'status',
        'estimatedArrivalStart',
        'estimatedArrivalEnd',
        'routePosition',
        'deliveredAt',
        'trackingExpiresAt',
        'csatScore',
        'assignedDriverId',
      ],
      relations: ['assignedDriver'],
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
    this.logger.log(`getDriverRoute called for driver: ${driverId}`);

    // Debug: count orders assigned to this driver
    const totalAssigned = await this.orderRepository.count({
      where: { assignedDriverId: driverId },
    });
    this.logger.log(`Total orders assigned to driver ${driverId}: ${totalAssigned}`);

    // Debug: count by status
    const inTransitCount = await this.orderRepository.count({
      where: { assignedDriverId: driverId, status: OrderStatus.IN_TRANSIT },
    });
    const readyCount = await this.orderRepository.count({
      where: { assignedDriverId: driverId, status: OrderStatus.READY },
    });
    this.logger.log(`Driver ${driverId} orders - IN_TRANSIT: ${inTransitCount}, READY: ${readyCount}`);

    if (totalAssigned === 0) {
      // Check if there are any dispatched orders at all
      const allInTransit = await this.orderRepository.count({
        where: { status: OrderStatus.IN_TRANSIT },
      });
      this.logger.log(`Total IN_TRANSIT orders in system: ${allInTransit}`);
    }

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
        'pickupConfirmedAt',
        'pickupHasIssue',
        'enRouteAt',
        // NO incluye totalAmount (restricción MD050)
      ],
    });

    return orders;
  }

  /**
   * Debug method for driver route issues
   */
  async getDriverRouteDebug(driverId: string): Promise<{
    driverId: string;
    totalOrdersAssigned: number;
    ordersByStatus: Record<string, number>;
    allDriversWithOrders: Array<{ driverId: string; count: number }>;
    sampleOrders: Array<{ id: string; status: string; assignedDriverId: string | null }>;
  }> {
    const totalOrdersAssigned = await this.orderRepository.count({
      where: { assignedDriverId: driverId },
    });

    const ordersByStatus: Record<string, number> = {};
    for (const status of Object.values(OrderStatus)) {
      ordersByStatus[status] = await this.orderRepository.count({
        where: { assignedDriverId: driverId, status },
      });
    }

    // Get all drivers that have orders assigned
    const driversWithOrders = await this.orderRepository
      .createQueryBuilder('order')
      .select('order.assignedDriverId', 'driverId')
      .addSelect('COUNT(*)', 'count')
      .where('order.assignedDriverId IS NOT NULL')
      .groupBy('order.assignedDriverId')
      .getRawMany();

    // Get sample IN_TRANSIT orders
    const sampleOrders = await this.orderRepository.find({
      where: { status: OrderStatus.IN_TRANSIT },
      select: ['id', 'status', 'assignedDriverId'],
      take: 10,
    });

    return {
      driverId,
      totalOrdersAssigned,
      ordersByStatus,
      allDriversWithOrders: driversWithOrders.map(d => ({
        driverId: d.driverId,
        count: parseInt(d.count, 10),
      })),
      sampleOrders: sampleOrders.map(o => ({
        id: o.id,
        status: o.status,
        assignedDriverId: o.assignedDriverId,
      })),
    };
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

  // =============================================
  // ADDRESS CHANGE REQUESTS (for IN_TRANSIT orders)
  // =============================================

  /**
   * Request address change for an order in transit
   * Creates a pending request that the driver must approve
   */
  async requestAddressChange(
    dto: RequestAddressChangeDto,
    requesterId: string,
  ): Promise<AddressChangeRequest> {
    const order = await this.orderRepository.findOne({
      where: { id: dto.orderId },
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }

    if (order.status !== OrderStatus.IN_TRANSIT) {
      throw new BadRequestException(
        'Solo se pueden solicitar cambios de dirección para pedidos en tránsito',
      );
    }

    if (!order.assignedDriverId) {
      throw new BadRequestException('El pedido no tiene un chofer asignado');
    }

    // Check if there's already a pending request for this order
    const existingPending = await this.addressChangeRepository.findOne({
      where: {
        orderId: dto.orderId,
        status: AddressChangeStatus.PENDING,
      },
    });

    if (existingPending) {
      throw new BadRequestException(
        'Ya existe una solicitud pendiente para este pedido',
      );
    }

    const request = this.addressChangeRepository.create({
      orderId: dto.orderId,
      requestedById: requesterId,
      driverId: order.assignedDriverId,
      oldAddress: order.addressRaw,
      newAddress: dto.newAddress,
      status: AddressChangeStatus.PENDING,
    });

    await this.addressChangeRepository.save(request);

    this.logger.log(
      `Address change requested for order ${dto.orderId} by user ${requesterId}`,
    );

    // Send push notification to driver
    try {
      await this.pushService.sendToUser(order.assignedDriverId, {
        title: 'Cambio de Direccion Solicitado',
        body: `Se solicito un cambio de direccion para el pedido de ${order.clientName}`,
        data: {
          type: 'ADDRESS_CHANGE_REQUEST',
          orderId: dto.orderId,
          requestId: request.id,
        },
        actions: [
          { action: 'view', title: 'Ver Solicitud' },
        ],
      });
    } catch (pushError) {
      this.logger.warn(`Failed to send push notification for address change: ${pushError.message}`);
    }

    return request;
  }

  /**
   * Get pending address change requests for a driver
   */
  async getDriverPendingAddressChanges(
    driverId: string,
  ): Promise<AddressChangeRequest[]> {
    this.logger.log(`Fetching pending address changes for driver: ${driverId}`);

    const requests = await this.addressChangeRepository.find({
      where: {
        driverId,
        status: AddressChangeStatus.PENDING,
      },
      relations: ['order', 'requestedBy'],
      order: { createdAt: 'ASC' },
    });

    this.logger.log(`Found ${requests.length} pending address change requests for driver ${driverId}`);

    return requests;
  }

  /**
   * Driver responds to address change request
   */
  async respondToAddressChange(
    requestId: string,
    dto: RespondAddressChangeDto,
    driverId: string,
  ): Promise<{ success: boolean; message: string }> {
    const request = await this.addressChangeRepository.findOne({
      where: { id: requestId },
      relations: ['order'],
    });

    if (!request) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    if (request.driverId !== driverId) {
      throw new ForbiddenException('No tienes permiso para responder esta solicitud');
    }

    if (request.status !== AddressChangeStatus.PENDING) {
      throw new BadRequestException('Esta solicitud ya fue procesada');
    }

    if (dto.approved) {
      // Update the order address
      await this.orderRepository.update(request.orderId, {
        addressRaw: request.newAddress,
        latitude: null, // Reset coordinates to trigger re-geocoding
        longitude: null,
      });

      request.status = AddressChangeStatus.APPROVED;
      request.respondedAt = new Date();
      await this.addressChangeRepository.save(request);

      // Try to geocode the new address
      try {
        await this.geocodeSingleOrder(request.orderId);
      } catch (err) {
        this.logger.warn(`Failed to geocode after address change: ${err.message}`);
      }

      this.logger.log(`Address change approved for order ${request.orderId}`);
      return { success: true, message: 'Cambio de dirección aprobado' };
    } else {
      // Rejection
      if (!dto.rejectionReason) {
        throw new BadRequestException('Se requiere un motivo de rechazo');
      }

      request.status = AddressChangeStatus.REJECTED;
      request.rejectionReason = dto.rejectionReason;
      request.respondedAt = new Date();
      await this.addressChangeRepository.save(request);

      this.logger.log(
        `Address change rejected for order ${request.orderId}: ${dto.rejectionReason}`,
      );
      return { success: true, message: 'Cambio de dirección rechazado' };
    }
  }

  /**
   * Driver returns an order (undelivered)
   * Order goes back to READY status with notes
   */
  async returnOrder(
    dto: ReturnOrderDto,
    driverId: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Return order request: orderId=${dto.orderId}, driverId=${driverId}, reason=${dto.reason}`);

    const order = await this.orderRepository.findOne({
      where: { id: dto.orderId },
    });

    if (!order) {
      this.logger.warn(`Return order failed: order ${dto.orderId} not found`);
      throw new NotFoundException('Pedido no encontrado');
    }

    this.logger.log(`Order ${dto.orderId} found: status=${order.status}, assignedDriverId=${order.assignedDriverId}`);

    if (order.assignedDriverId !== driverId) {
      this.logger.warn(`Return order failed: driver ${driverId} is not assigned to order ${dto.orderId} (assigned: ${order.assignedDriverId})`);
      throw new ForbiddenException('No tienes permiso para devolver este pedido');
    }

    if (order.status !== OrderStatus.IN_TRANSIT) {
      this.logger.warn(`Return order failed: order ${dto.orderId} is not in transit (status: ${order.status})`);
      throw new BadRequestException('Solo se pueden devolver pedidos en tránsito');
    }

    // Update order status to READY and add return notes
    const returnNote = `[DEVUELTO ${new Date().toLocaleDateString('es-MX')}] ${dto.reason}${dto.notes ? '\n' + dto.notes : ''}`;
    const existingNotes = order.internalNotes || '';
    const updatedNotes = existingNotes
      ? `${existingNotes}\n\n${returnNote}`
      : returnNote;

    await this.orderRepository.update(dto.orderId, {
      status: OrderStatus.READY,
      internalNotes: updatedNotes,
      assignedDriverId: null, // Remove driver assignment
      routePosition: null,
      estimatedArrivalStart: null,
      estimatedArrivalEnd: null,
    });

    this.logger.log(`Order ${dto.orderId} returned by driver ${driverId}: ${dto.reason}`);

    return {
      success: true,
      message: 'Pedido devuelto correctamente',
    };
  }

  /**
   * Helper method to geocode a single order
   */
  private async geocodeSingleOrder(orderId: string): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) return;

    const result = await this.geocodingService.geocodeAddress(order.addressRaw);
    if (result) {
      await this.orderRepository.update(orderId, {
        latitude: result.latitude,
        longitude: result.longitude,
      });
    }
  }

  // =============================================
  // PICKUP CONFIRMATION & EN-ROUTE TRACKING
  // =============================================

  /**
   * Driver confirms pickup (receipt) of an order before leaving
   * Can optionally report an issue with the order
   */
  async confirmPickup(
    orderId: string,
    driverId: string,
    dto: ConfirmPickupDto,
  ): Promise<{ success: boolean; confirmedAt: Date }> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Pedido ${orderId} no encontrado`);
    }

    if (order.assignedDriverId !== driverId) {
      throw new ForbiddenException('No tienes permiso para confirmar este pedido');
    }

    if (order.status !== OrderStatus.IN_TRANSIT) {
      throw new BadRequestException('Solo se pueden confirmar pedidos despachados (IN_TRANSIT)');
    }

    if (order.pickupConfirmedAt) {
      throw new BadRequestException('Este pedido ya fue confirmado');
    }

    const now = new Date();

    await this.orderRepository.update(orderId, {
      pickupConfirmedAt: now,
      pickupConfirmedBy: driverId,
      pickupHasIssue: dto.hasIssue || false,
      pickupIssueNotes: dto.issueNotes || null,
    });

    this.logger.log(
      `Order ${orderId} pickup confirmed by driver ${driverId}${dto.hasIssue ? ' (with issue)' : ''}`,
    );

    // If there's an issue, notify traffic team via push
    if (dto.hasIssue && dto.issueNotes) {
      // Could add notification queue here for traffic team
      this.logger.warn(`Pickup issue reported for order ${orderId}: ${dto.issueNotes}`);
    }

    return { success: true, confirmedAt: now };
  }

  /**
   * Driver marks they are en-route to deliver an order
   * Triggers email notification to customer
   */
  async markEnRoute(
    orderId: string,
    driverId: string,
  ): Promise<{ success: boolean; enRouteAt: Date }> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['assignedDriver', 'client'],
    });

    if (!order) {
      throw new NotFoundException(`Pedido ${orderId} no encontrado`);
    }

    if (order.assignedDriverId !== driverId) {
      throw new ForbiddenException('No tienes permiso para marcar este pedido');
    }

    if (order.status !== OrderStatus.IN_TRANSIT) {
      throw new BadRequestException('Solo se pueden marcar pedidos en tránsito');
    }

    if (!order.pickupConfirmedAt) {
      throw new BadRequestException('Primero debes confirmar la recepción del pedido');
    }

    if (order.enRouteAt) {
      throw new BadRequestException('Este pedido ya fue marcado como en camino');
    }

    const now = new Date();

    // Generar trackingHash si no existe
    const trackingHash = order.trackingHash || this.generateTrackingHash();

    await this.orderRepository.update(orderId, {
      enRouteAt: now,
      trackingHash: trackingHash,
    });

    this.logger.log(`Order ${orderId} marked en-route by driver ${driverId}`);

    // Queue email notification to customer - usar email del cliente como fallback
    const recipientEmail = order.clientEmail || order.client?.email;
    if (recipientEmail && !order.enRouteEmailSent) {
      // Usar jobId único para evitar correos duplicados
      const jobId = `enroute-${orderId}-${new Date().toISOString().split('T')[0]}`;
      await this.notificationQueue.add(
        'send-en-route-email',
        {
          orderId,
          clientEmail: recipientEmail,
          clientName: order.clientName,
          driverName: order.assignedDriver
            ? `${order.assignedDriver.firstName} ${order.assignedDriver.lastName}`
            : 'Nuestro chofer',
          estimatedArrivalStart: order.estimatedArrivalStart?.toISOString(),
          estimatedArrivalEnd: order.estimatedArrivalEnd?.toISOString(),
          trackingHash: trackingHash,
        },
        {
          jobId, // Previene duplicados con el mismo jobId
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      );

      await this.orderRepository.update(orderId, { enRouteEmailSent: true });
      this.logger.log(`En-route email queued for order ${orderId}`);
    }

    return { success: true, enRouteAt: now };
  }

  /**
   * Get orders pending pickup confirmation for a driver
   */
  async getDriverPendingPickupConfirmation(driverId: string): Promise<Order[]> {
    return this.orderRepository.find({
      where: {
        assignedDriverId: driverId,
        status: OrderStatus.IN_TRANSIT,
        pickupConfirmedAt: IsNull(),
      },
      order: { routePosition: 'ASC' },
    });
  }

  // =============================================
  // INVOICE-BASED ORDER CREATION (WebHooks)
  // =============================================

  /**
   * Busca una orden por el ID de factura de Bind
   * Usado para evitar duplicados cuando llegan webhooks
   */
  async findByBindInvoiceId(bindInvoiceId: string): Promise<Order | null> {
    return this.orderRepository.findOne({
      where: { bindInvoiceId },
    });
  }

  /**
   * Crea una orden de entrega desde una factura de Bind
   * Usado por el webhook Add_Invoice
   */
  async createFromInvoice(invoiceData: {
    bindId: string;
    bindInvoiceId: string;
    invoiceNumber: string;
    orderSource: OrderSource;
    carrierType: CarrierType;
    carrierName?: string;
    clientId?: string;
    bindClientId?: string;
    clientName: string;
    clientEmail: string;
    clientPhone?: string;
    clientRfc?: string;
    totalAmount: number;
    warehouseName?: string;
    employeeName?: string;
    purchaseOrder?: string;
    addressRaw: {
      street: string;
      number: string;
      neighborhood: string;
      postalCode: string;
      city: string;
      state: string;
      reference?: string;
      original?: string;
    };
    internalNotes?: string;
  }): Promise<Order> {
    this.logger.log(`Creando orden desde factura ${invoiceData.invoiceNumber}...`);

    // Determinar estado inicial basado en tipo de carrier
    // PROVIDER = solo seguimiento, no requiere ruta interna
    const initialStatus =
      invoiceData.carrierType === CarrierType.PROVIDER
        ? OrderStatus.READY // Listo para que proveedor lo entregue
        : OrderStatus.DRAFT; // Requiere planificación de ruta

    const order = this.orderRepository.create({
      bindId: invoiceData.bindId,
      bindInvoiceId: invoiceData.bindInvoiceId,
      orderNumber: invoiceData.invoiceNumber, // Usar número de factura como número de orden
      invoiceNumber: invoiceData.invoiceNumber,
      orderSource: invoiceData.orderSource,
      carrierType: invoiceData.carrierType,
      carrierName: invoiceData.carrierName || null,
      clientId: invoiceData.clientId || null,
      bindClientId: invoiceData.bindClientId || null,
      clientName: invoiceData.clientName,
      clientEmail: invoiceData.clientEmail,
      clientPhone: invoiceData.clientPhone || null,
      clientRfc: invoiceData.clientRfc || null,
      totalAmount: invoiceData.totalAmount,
      warehouseName: invoiceData.warehouseName || null,
      employeeName: invoiceData.employeeName || null,
      purchaseOrder: invoiceData.purchaseOrder || null,
      addressRaw: invoiceData.addressRaw,
      status: initialStatus,
      priorityLevel: PriorityLevel.NORMAL,
      internalNotes: invoiceData.internalNotes || null,
    });

    const savedOrder = await this.orderRepository.save(order);

    this.logger.log(
      `Orden creada: ${savedOrder.id} | Factura: ${invoiceData.invoiceNumber} | Carrier: ${invoiceData.carrierType}`,
    );

    // Intentar geocodificar la dirección
    if (invoiceData.addressRaw.street || invoiceData.addressRaw.original) {
      try {
        const addressString = invoiceData.addressRaw.original ||
          `${invoiceData.addressRaw.street} ${invoiceData.addressRaw.number}, ${invoiceData.addressRaw.neighborhood}, ${invoiceData.addressRaw.city}, ${invoiceData.addressRaw.state} ${invoiceData.addressRaw.postalCode}`;

        const geoResult = await this.geocodingService.geocodeAddress({ street: addressString });
        if (geoResult) {
          await this.orderRepository.update(savedOrder.id, {
            latitude: geoResult.latitude,
            longitude: geoResult.longitude,
            addressGeo: () =>
              `ST_SetSRID(ST_MakePoint(${geoResult.longitude}, ${geoResult.latitude}), 4326)`,
          });
          this.logger.log(`Orden ${savedOrder.id} geocodificada: ${geoResult.latitude}, ${geoResult.longitude}`);
        }
      } catch (geoError) {
        this.logger.warn(`Error geocodificando orden ${savedOrder.id}: ${geoError.message}`);
      }
    }

    return savedOrder;
  }
}
