import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Order } from '@/modules/orders/entities/order.entity';
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
  trackingNumber?: string;
  estimatedDeliveryDate?: string;
  estimatedDeliveryTime?: string;
  trackingHash: string;
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

    // Format ETA times
    const etaStartDate = new Date(etaStart);
    const etaEndDate = new Date(etaEnd);

    const formatTime = (date: Date) => {
      return date.toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    };

    const etaRange = `${formatTime(etaStartDate)} - ${formatTime(etaEndDate)}`;

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

    // Format ETA times
    let etaRange = 'Muy pronto';
    if (estimatedArrivalStart && estimatedArrivalEnd) {
      const etaStartDate = new Date(estimatedArrivalStart);
      const etaEndDate = new Date(estimatedArrivalEnd);

      const formatTime = (date: Date) => {
        return date.toLocaleTimeString('es-MX', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      };

      etaRange = `${formatTime(etaStartDate)} - ${formatTime(etaEndDate)}`;
    }

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
    const { orderId, clientEmail, clientName, carrierName, trackingNumber, estimatedDeliveryDate, estimatedDeliveryTime, trackingHash } = payload;

    // Format delivery date
    let deliveryInfo = 'Pronto';
    if (estimatedDeliveryDate) {
      const date = new Date(estimatedDeliveryDate);
      deliveryInfo = date.toLocaleDateString('es-MX', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
      if (estimatedDeliveryTime) {
        deliveryInfo += ` aproximadamente a las ${estimatedDeliveryTime}`;
      }
    }

    await this.emailService.sendEmail({
      to: clientEmail,
      subject: `📦 ¡Tu pedido SCRAM fue enviado por ${carrierName}!`,
      template: 'carrier-shipment',
      context: {
        clientName: clientName.split(' ')[0],
        carrierName,
        trackingNumber: trackingNumber || 'Pendiente',
        deliveryInfo,
        trackingUrl: `${process.env.APP_URL}/track/${trackingHash}`,
      },
    });

    this.logger.log(`Carrier shipment email sent to ${clientEmail} for order ${orderId}`);
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
