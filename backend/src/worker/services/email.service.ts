import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  template: string;
  context: Record<string, any>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly from: string;
  private readonly transporter: nodemailer.Transporter;

  // STAGING MODE: Redirect all customer emails to this address for testing
  // TODO: Remove this override when going to production
  private readonly STAGING_EMAIL_OVERRIDE = 'armando.cortes@entersys.mx';

  constructor(private readonly configService: ConfigService) {
    this.from = this.configService.get('email.from') || 'notificaciones@scram2k.com';

    // Configure Gmail SMTP transporter
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'armando.cortes@entersys.mx',
        pass: 'izgs zmmp sapa nupz',
      },
    });
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    // STAGING: Override recipient email for all customer notifications
    const originalRecipient = options.to;
    const recipientEmail = this.STAGING_EMAIL_OVERRIDE;

    this.logger.log(`[STAGING] Email redirected: ${originalRecipient} -> ${recipientEmail}`);

    const html = this.renderTemplate(options.template, {
      ...options.context,
      _originalRecipient: originalRecipient,
    });

    try {
      const info = await this.transporter.sendMail({
        from: `"SCRAM Logistica" <${this.from}>`,
        to: recipientEmail,
        subject: `[STAGING] ${options.subject}`,
        html: html,
      });

      this.logger.log(`Email sent successfully to ${recipientEmail} (original: ${originalRecipient}) - MessageId: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${recipientEmail}:`, error);
      throw error;
    }
  }

  private renderTemplate(template: string, context: Record<string, any>): string {
    const templates: Record<string, (ctx: any) => string> = {
      'eta-notification': this.etaNotificationTemplate,
      'delivery-confirmation': this.deliveryConfirmationTemplate,
      'detractor-alert': this.detractorAlertTemplate,
      'en-route-notification': this.enRouteNotificationTemplate,
    };

    const templateFn = templates[template];
    if (!templateFn) {
      throw new Error(`Unknown email template: ${template}`);
    }

    return templateFn(context);
  }

  private etaNotificationTemplate(ctx: any): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tu pedido va en camino</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .eta-box { background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
    .eta-time { font-size: 28px; font-weight: bold; color: #333; }
    .btn { display: inline-block; background: #667eea; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Tu pedido va en camino!</h1>
    </div>
    <div class="content">
      <p>Hola <strong>${ctx.clientName}</strong>,</p>
      <p>Buenas noticias: tu pedido ha salido de nuestro almacen y esta en camino.</p>

      <p><strong>Tu chofer asignado es:</strong> ${ctx.driverName}</p>

      <div class="eta-box">
        <p style="margin: 0 0 10px 0; color: #666;">Hora Estimada de Llegada:</p>
        <div class="eta-time">${ctx.etaRange}</div>
        <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Parada #${ctx.routePosition} de la ruta</p>
      </div>

      <p>Por favor, asegurate de que haya alguien disponible para recibir el paquete.</p>

      <a href="${ctx.trackingUrl}" class="btn">Ver Estatus en Tiempo Real</a>
    </div>
    <div class="footer">
      <p>SCRAM Logistica - Sistema de Gestion de Entregas</p>
      <p>Si tienes alguna pregunta, contacta a nuestro equipo de soporte.</p>
    </div>
  </div>
</body>
</html>`;
  }

  private deliveryConfirmationTemplate(ctx: any): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pedido Entregado</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 30px; text-align: center; color: white; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .stars { text-align: center; margin: 20px 0; }
    .star { display: inline-block; font-size: 36px; color: #ddd; text-decoration: none; margin: 0 5px; transition: color 0.2s; }
    .star:hover { color: #ffc107; }
    .btn { display: inline-block; background: #11998e; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Pedido Entregado!</h1>
    </div>
    <div class="content">
      <p>Hola <strong>${ctx.clientName}</strong>,</p>
      <p>Confirmamos que tu pedido ha sido entregado exitosamente.</p>

      <p style="text-align: center; margin: 30px 0;"><strong>Como fue tu experiencia?</strong></p>

      <div class="stars">
        <a href="${ctx.csatUrl}&score=1" class="star">1</a>
        <a href="${ctx.csatUrl}&score=2" class="star">2</a>
        <a href="${ctx.csatUrl}&score=3" class="star">3</a>
        <a href="${ctx.csatUrl}&score=4" class="star">4</a>
        <a href="${ctx.csatUrl}&score=5" class="star">5</a>
      </div>

      <p style="text-align: center; color: #666; font-size: 14px;">Haz clic en un numero para calificar</p>

      <p style="text-align: center; margin-top: 30px;">
        <a href="${ctx.csatUrl}" class="btn">Ver Detalles de Entrega</a>
      </p>
    </div>
    <div class="footer">
      <p>Gracias por confiar en nosotros!</p>
      <p>SCRAM Logistica - Sistema de Gestion de Entregas</p>
    </div>
  </div>
</body>
</html>`;
  }

  private detractorAlertTemplate(ctx: any): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Alerta de Calificacion Negativa</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%); padding: 30px; text-align: center; color: white; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .alert-box { background: #fff3cd; border: 1px solid #ffc107; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    .info-label { color: #666; }
    .info-value { font-weight: bold; }
    .score { font-size: 48px; text-align: center; color: #dc3545; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ALERTA: Calificacion Negativa</h1>
    </div>
    <div class="content">
      <div class="score">${ctx.score}/5</div>
      <p style="text-align: center; color: #666;">Calificacion: ${ctx.score}/5</p>

      <div class="alert-box">
        <p><strong>Comentario del cliente:</strong></p>
        <p>"${ctx.feedback}"</p>
      </div>

      <h3>Detalles del Pedido:</h3>
      <div class="info-row">
        <span class="info-label">Cliente:</span>
        <span class="info-value">${ctx.clientName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">ID Pedido:</span>
        <span class="info-value">${ctx.orderId}</span>
      </div>
      <div class="info-row">
        <span class="info-label">ID Bind:</span>
        <span class="info-value">${ctx.bindId || 'N/A'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Chofer:</span>
        <span class="info-value">${ctx.driverName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Fecha Entrega:</span>
        <span class="info-value">${ctx.deliveredAt}</span>
      </div>

      <p style="margin-top: 20px; color: #dc3545; font-weight: bold;">
        Se recomienda contactar al cliente dentro de las proximas 24 horas para seguimiento.
      </p>
    </div>
    <div class="footer">
      <p>Sistema de Alertas SCRAM - Ticket de Rescate Automatico</p>
    </div>
  </div>
</body>
</html>`;
  }

  private enRouteNotificationTemplate(ctx: any): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tu pedido esta en camino</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; text-align: center; color: white; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .driver-box { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
    .eta-box { background: #fff3e0; border-left: 4px solid #ff9800; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
    .eta-time { font-size: 24px; font-weight: bold; color: #333; }
    .icon { font-size: 48px; text-align: center; margin: 20px 0; }
    .btn { display: inline-block; background: #f5576c; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Tu pedido esta en camino!</h1>
    </div>
    <div class="content">
      <p>Hola <strong>${ctx.clientName}</strong>,</p>
      <p>Te informamos que nuestro chofer ya salio a entregar tu pedido.</p>

      <div class="driver-box">
        <p style="margin: 0 0 10px 0; color: #1565c0;"><strong>Chofer asignado:</strong></p>
        <p style="margin: 0; font-size: 18px; font-weight: bold;">${ctx.driverName}</p>
      </div>

      <div class="eta-box">
        <p style="margin: 0 0 10px 0; color: #e65100;"><strong>Hora estimada de llegada:</strong></p>
        <div class="eta-time">${ctx.etaRange}</div>
      </div>

      <p>Por favor, asegurate de que haya alguien disponible para recibir el paquete.</p>

      <p style="text-align: center;">
        <a href="${ctx.trackingUrl}" class="btn">Rastrear Mi Pedido</a>
      </p>
    </div>
    <div class="footer">
      <p>SCRAM Logistica - Sistema de Gestion de Entregas</p>
      <p>Si tienes alguna pregunta, contacta a nuestro equipo de soporte.</p>
    </div>
  </div>
</body>
</html>`;
  }
}
