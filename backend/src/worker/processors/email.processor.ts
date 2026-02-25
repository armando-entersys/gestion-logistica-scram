import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Order } from '@/modules/orders/entities/order.entity';
import { OrderStatus } from '@/common/enums';
import { User } from '@/modules/users/entities/user.entity';
import { EmailService } from '../services/email.service';

interface EtaEmailPayload {
  orderId: string;
  clientEmail: string;
  clientName: string;
  driverId: string;
  etaStart: string;
  etaEnd: string;
  trackingHash: string;
  routePosition: number;
}

interface DeliveryConfirmationPayload {
  orderId: string;
  clientEmail: string;
  clientName: string;
  trackingHash: string;
}

interface DetractorAlertPayload {
  orderId: string;
  score: number;
  feedback?: string;
  clientName: string;
}

interface EnRouteEmailPayload {
  orderId: string;
  clientEmail: string;
  clientName: string;
  driverName: string;
  estimatedArrivalStart?: string;
  estimatedArrivalEnd?: string;
  trackingHash: string;
}

interface PasswordResetPayload {
  email: string;
  userName: string;
  resetUrl: string;
}

interface CarrierShipmentPayload {
  orderId: string;
  clientEmail: string;
  clientName: string;
  carrierName: string;
  carrierType?: string;
  trackingNumber?: string;
  estimatedDeliveryDate?: string;
  estimatedDeliveryTime?: string;
  trackingHash: string;
}

// Batch interfaces
interface EtaEmailBatchPayload {
  clientEmail: string;
  clientName: string;
  driverId: string;
  etaStart: string;
  etaEnd: string;
  orders: Array<{
    orderId: string;
    trackingHash: string;
    routePosition: number;
    orderNumber: string;
  }>;
}

interface CarrierShipmentBatchPayload {
  clientEmail: string;
  clientName: string;
  orders: Array<{
    orderId: string;
    trackingHash: string;
    carrierName: string;
    carrierType: string;
    trackingNumber: string | null;
    deliveryInfo: string;
    orderNumber: string;
  }>;
}

interface EnRouteBatchPayload {
  clientEmail: string;
  driverId: string;
}

interface DeliveryConfirmationBatchPayload {
  clientEmail: string;
}

@Processor('notifications')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly emailService: EmailService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing job ${job.name} [${job.id}]`);

    switch (job.name) {
      case 'send-eta-email':
        await this.handleEtaEmail(job.data as EtaEmailPayload);
        break;

      case 'send-delivery-confirmation':
        await this.handleDeliveryConfirmation(job.data as DeliveryConfirmationPayload);
        break;

      case 'send-detractor-alert':
        await this.handleDetractorAlert(job.data as DetractorAlertPayload);
        break;

      case 'send-en-route-email':
        await this.handleEnRouteEmail(job.data as EnRouteEmailPayload);
        break;

      case 'send-password-reset':
        await this.handlePasswordReset(job.data as PasswordResetPayload);
        break;

      case 'send-carrier-shipment':
        await this.handleCarrierShipment(job.data as CarrierShipmentPayload);
        break;

      // Batch handlers (consolidated emails per client)
      case 'send-eta-email-batch':
        await this.handleEtaEmailBatch(job.data as EtaEmailBatchPayload);
        break;

      case 'send-carrier-shipment-batch':
        await this.handleCarrierShipmentBatch(job.data as CarrierShipmentBatchPayload);
        break;

      case 'send-en-route-email-batch':
        await this.handleEnRouteEmailBatch(job.data as EnRouteBatchPayload);
        break;

      case 'send-delivery-confirmation-batch':
        await this.handleDeliveryConfirmationBatch(job.data as DeliveryConfirmationBatchPayload);
        break;

      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
    }
  }

  /**
   * RF-12: Notificación Proactiva de "Pedido en Camino" con ETA
   */
  private async handleEtaEmail(payload: EtaEmailPayload): Promise<void> {
    const { orderId, clientEmail, clientName, driverId, etaStart, etaEnd, trackingHash, routePosition } = payload;

    // Get driver info
    const driver = await this.userRepository.findOne({ where: { id: driverId } });
    const driverName = driver?.fullName || 'Tu chofer asignado';

    // Rango fijo de horario de entrega (no exponer hora exacta al cliente)
    const etaRange = '9:00 AM - 6:00 PM';

    await this.emailService.sendEmail({
      to: clientEmail,
      subject: '🚀 ¡Tu pedido SCRAM va en camino!',
      template: 'eta-notification',
      context: {
        clientName: clientName.split(' ')[0], // First name only
        driverName,
        etaRange,
        trackingUrl: `${process.env.APP_URL}/track/${trackingHash}`,
        routePosition,
      },
    });

    this.logger.log(`ETA email sent to ${clientEmail} for order ${orderId}`);
  }

  /**
   * RF-05: Email de confirmación con encuesta CSAT
   */
  private async handleDeliveryConfirmation(payload: DeliveryConfirmationPayload): Promise<void> {
    const { orderId, clientEmail, clientName, trackingHash } = payload;

    await this.emailService.sendEmail({
      to: clientEmail,
      subject: '✅ ¡Tu pedido ha sido entregado! - Cuéntanos tu experiencia',
      template: 'delivery-confirmation',
      context: {
        clientName: clientName.split(' ')[0],
        csatUrl: `${process.env.APP_URL}/track/${trackingHash}#csat`,
        orderId,
        trackingHash,
      },
    });

    // Update flag in database
    await this.orderRepository.update(orderId, { deliveryEmailSent: true });

    this.logger.log(`Delivery confirmation sent to ${clientEmail} for order ${orderId}`);
  }

  /**
   * RF-05: Alerta de detractor (calificación 1-2 estrellas)
   */
  private async handleDetractorAlert(payload: DetractorAlertPayload): Promise<void> {
    const { orderId, score, feedback, clientName } = payload;

    // Get order details
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['assignedDriver'],
    });

    // Get admin/operations manager emails (in real implementation)
    const alertEmail = process.env.OPERATIONS_ALERT_EMAIL || process.env.EMAIL_FROM;

    await this.emailService.sendEmail({
      to: alertEmail!,
      subject: `🚨 ALERTA: Calificación Negativa - Cliente ${clientName}`,
      template: 'detractor-alert',
      context: {
        clientName,
        score,
        feedback: feedback || 'Sin comentarios',
        orderId,
        bindId: order?.bindId,
        driverName: order?.assignedDriver?.fullName || 'No asignado',
        deliveredAt: order?.deliveredAt?.toLocaleString('es-MX'),
      },
    });

    this.logger.warn(`Detractor alert sent for order ${orderId} - Score: ${score}`);
  }

  /**
   * En-Route notification: Driver is heading to deliver this specific order
   */
  private async handleEnRouteEmail(payload: EnRouteEmailPayload): Promise<void> {
    const { orderId, clientEmail, clientName, driverName, estimatedArrivalStart, estimatedArrivalEnd, trackingHash } = payload;

    // Rango fijo de horario de entrega (no exponer hora exacta al cliente)
    const etaRange = '9:00 AM - 6:00 PM';

    await this.emailService.sendEmail({
      to: clientEmail,
      subject: '🚗 ¡Tu pedido SCRAM esta en camino!',
      template: 'en-route-notification',
      context: {
        clientName: clientName.split(' ')[0], // First name only
        driverName,
        etaRange,
        trackingUrl: `${process.env.APP_URL}/track/${trackingHash}`,
      },
    });

    this.logger.log(`En-route email sent to ${clientEmail} for order ${orderId}`);
  }

  /**
   * Password Reset Email
   */
  private async handlePasswordReset(payload: PasswordResetPayload): Promise<void> {
    const { email, userName, resetUrl } = payload;

    await this.emailService.sendEmail({
      to: email,
      subject: '🔐 Restablecer tu contraseña - SCRAM Logistica',
      template: 'password-reset',
      context: {
        userName,
        resetUrl,
      },
    });

    this.logger.log(`Password reset email sent to ${email}`);
  }

  /**
   * Carrier Shipment notification: Order shipped via external carrier
   */
  private async handleCarrierShipment(payload: CarrierShipmentPayload): Promise<void> {
    const { orderId, clientEmail, clientName, carrierName, carrierType, trackingNumber, estimatedDeliveryDate, estimatedDeliveryTime, trackingHash } = payload;

    const isProvider = carrierType === 'PROVIDER';

    // Format delivery date con rango de horario fijo
    let deliveryInfo = 'Pronto';
    if (estimatedDeliveryDate) {
      const date = new Date(estimatedDeliveryDate);
      deliveryInfo = date.toLocaleDateString('es-MX', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
      deliveryInfo += ' entre 9:00 AM y 6:00 PM';
    }

    // For "Proveedor Directo": hide carrier details, SCRAM handles delivery
    const subject = isProvider
      ? '📦 ¡Tu pedido SCRAM fue enviado!'
      : `📦 ¡Tu pedido SCRAM fue enviado por ${carrierName}!`;

    await this.emailService.sendEmail({
      to: clientEmail,
      subject,
      template: 'carrier-shipment',
      context: {
        clientName: clientName.split(' ')[0],
        carrierName: isProvider ? 'SCRAM' : carrierName,
        trackingNumber: isProvider ? null : (trackingNumber || 'Pendiente'),
        deliveryInfo,
        trackingUrl: `${process.env.APP_URL}/track/${trackingHash}`,
        isProvider,
      },
    });

    this.logger.log(`Carrier shipment email sent to ${clientEmail} for order ${orderId}`);
  }

  // =============================================
  // BATCH HANDLERS (consolidated emails per client)
  // =============================================

  /**
   * Batch ETA email: sends 1 consolidated email with all orders for this client
   */
  private async handleEtaEmailBatch(payload: EtaEmailBatchPayload): Promise<void> {
    const { clientEmail, clientName, driverId, etaStart, etaEnd, orders } = payload;

    const driver = await this.userRepository.findOne({ where: { id: driverId } });
    const driverName = driver?.fullName || 'Tu chofer asignado';
    const etaRange = '9:00 AM - 6:00 PM';
    const appUrl = process.env.APP_URL || '';

    const orderList = orders.map(o => ({
      ...o,
      trackingUrl: `${appUrl}/track/${o.trackingHash}`,
    }));

    const n = orders.length;
    const subject = n === 1
      ? '🚀 ¡Tu pedido SCRAM va en camino!'
      : `🚀 ¡Tus ${n} pedidos SCRAM van en camino!`;

    await this.emailService.sendEmail({
      to: clientEmail,
      subject,
      template: 'eta-notification-batch',
      context: {
        clientName: clientName.split(' ')[0],
        driverName,
        etaRange,
        orders: orderList,
        orderCount: n,
      },
    });

    this.logger.log(`Batch ETA email sent to ${clientEmail} for ${n} orders`);
  }

  /**
   * Batch carrier shipment email: sends 1 consolidated email with all orders for this client
   */
  private async handleCarrierShipmentBatch(payload: CarrierShipmentBatchPayload): Promise<void> {
    const { clientEmail, clientName, orders } = payload;
    const appUrl = process.env.APP_URL || '';

    const orderList = orders.map(o => ({
      ...o,
      trackingUrl: `${appUrl}/track/${o.trackingHash}`,
      isProvider: o.carrierType === 'PROVIDER',
    }));

    const n = orders.length;
    const subject = n === 1
      ? '📦 ¡Tu pedido SCRAM fue enviado!'
      : `📦 ¡Tus ${n} pedidos SCRAM fueron enviados!`;

    await this.emailService.sendEmail({
      to: clientEmail,
      subject,
      template: 'carrier-shipment-batch',
      context: {
        clientName: clientName.split(' ')[0],
        orders: orderList,
        orderCount: n,
      },
    });

    this.logger.log(`Batch carrier shipment email sent to ${clientEmail} for ${n} orders`);
  }

  /**
   * Batch en-route email: queries DB for all pending en-route orders for this client+driver
   * Uses 30s delay window for consolidation
   */
  private async handleEnRouteEmailBatch(payload: EnRouteBatchPayload): Promise<void> {
    const { clientEmail, driverId } = payload;

    // Query orders: same client email + same driver + marked en-route + email not sent yet
    const pendingOrders = await this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.assignedDriver', 'driver')
      .where('LOWER(order.clientEmail) = :email', { email: clientEmail.toLowerCase() })
      .andWhere('order.assignedDriverId = :driverId', { driverId })
      .andWhere('order.enRouteAt IS NOT NULL')
      .andWhere('order.enRouteEmailSent = false')
      .orderBy('order.routePosition', 'ASC')
      .getMany();

    if (pendingOrders.length === 0) {
      this.logger.log(`En-route batch: no pending orders for ${clientEmail} - already consolidated`);
      return;
    }

    const driver = pendingOrders[0].assignedDriver;
    const driverName = driver?.fullName || 'Nuestro chofer';
    const etaRange = '9:00 AM - 6:00 PM';
    const appUrl = process.env.APP_URL || '';

    const orderList = pendingOrders.map(o => ({
      orderId: o.id,
      orderNumber: o.orderNumber || o.bindId || o.id,
      trackingHash: o.trackingHash,
      trackingUrl: `${appUrl}/track/${o.trackingHash}`,
      routePosition: o.routePosition,
    }));

    const n = pendingOrders.length;
    const subject = n === 1
      ? '🚗 ¡Tu pedido SCRAM está en camino!'
      : `🚗 ¡Tus ${n} pedidos SCRAM están en camino!`;

    await this.emailService.sendEmail({
      to: clientEmail,
      subject,
      template: 'en-route-notification-batch',
      context: {
        clientName: pendingOrders[0].clientName?.split(' ')[0] || 'Cliente',
        driverName,
        etaRange,
        orders: orderList,
        orderCount: n,
      },
    });

    // Mark all as sent
    const orderIds = pendingOrders.map(o => o.id);
    await this.orderRepository
      .createQueryBuilder()
      .update(Order)
      .set({ enRouteEmailSent: true })
      .whereInIds(orderIds)
      .execute();

    this.logger.log(`Batch en-route email sent to ${clientEmail} for ${n} orders`);
  }

  /**
   * Batch delivery confirmation email: queries DB for all delivered orders pending email for this client
   * Uses 30s delay window for consolidation
   */
  private async handleDeliveryConfirmationBatch(payload: DeliveryConfirmationBatchPayload): Promise<void> {
    const { clientEmail } = payload;

    // Query orders: same client email + delivered + email not sent yet
    const pendingOrders = await this.orderRepository
      .createQueryBuilder('order')
      .where('LOWER(order.clientEmail) = :email', { email: clientEmail.toLowerCase() })
      .andWhere('order.status = :status', { status: OrderStatus.DELIVERED })
      .andWhere('order.deliveryEmailSent = false')
      .orderBy('order.deliveredAt', 'ASC')
      .getMany();

    if (pendingOrders.length === 0) {
      this.logger.log(`Delivery batch: no pending orders for ${clientEmail} - already consolidated`);
      return;
    }

    const appUrl = process.env.APP_URL || '';
    const apiUrl = process.env.API_URL || 'https://api-gestion-logistica.scram2k.com';

    const orderList = pendingOrders.map(o => ({
      orderId: o.id,
      orderNumber: o.orderNumber || o.bindId || o.id,
      trackingHash: o.trackingHash,
      csatUrl: `${appUrl}/track/${o.trackingHash}#csat`,
      rateUrl: `${apiUrl}/api/v1/orders/rate/${o.trackingHash}`,
      invoiceNumber: o.invoiceNumber || o.orderNumber || '',
    }));

    const n = pendingOrders.length;
    const subject = n === 1
      ? '✅ ¡Tu pedido ha sido entregado! - Cuéntanos tu experiencia'
      : `✅ ¡Tus ${n} pedidos han sido entregados! - Cuéntanos tu experiencia`;

    await this.emailService.sendEmail({
      to: clientEmail,
      subject,
      template: 'delivery-confirmation-batch',
      context: {
        clientName: pendingOrders[0].clientName?.split(' ')[0] || 'Cliente',
        orders: orderList,
        orderCount: n,
      },
    });

    // Mark all as sent
    const orderIds = pendingOrders.map(o => o.id);
    await this.orderRepository
      .createQueryBuilder()
      .update(Order)
      .set({ deliveryEmailSent: true })
      .whereInIds(orderIds)
      .execute();

    this.logger.log(`Batch delivery confirmation sent to ${clientEmail} for ${n} orders`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.name} [${job.id}] completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.name} [${job.id}] failed: ${error.message}`);
  }
}
