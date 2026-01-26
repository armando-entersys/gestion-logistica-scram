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

  // STAGING MODE: Redirect all customer emails to these addresses for testing
  // TODO: Remove this override when going to production
  private readonly STAGING_EMAIL_OVERRIDE = 'armando.cortes@entersys.mx, hpe@scram2k.com';

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
    body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); padding: 30px; text-align: center; color: white; }
    .header h1 { margin: 0; font-size: 24px; font-family: 'Cabin', 'Segoe UI', sans-serif; }
    .content { padding: 30px; }
    .eta-box { background: #f0fdfa; border-left: 4px solid #0d9488; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
    .eta-time { font-size: 28px; font-weight: bold; color: #0f766e; }
    .btn { display: inline-block; background: #0d9488; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; }
    .btn:hover { background: #0f766e; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
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

      <a href="${ctx.trackingUrl}" class="btn" style="color: #ffffff !important;">Ver Estatus en Tiempo Real</a>
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
    body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 30px; text-align: center; color: white; }
    .header h1 { margin: 0; font-size: 24px; font-family: 'Cabin', 'Segoe UI', sans-serif; }
    .content { padding: 30px; }
    .stars { text-align: center; margin: 20px 0; }
    .star { display: inline-block; font-size: 36px; color: #e2e8f0; text-decoration: none; margin: 0 5px; transition: color 0.2s; }
    .star:hover { color: #f59e0b; }
    .btn { display: inline-block; background: #0d9488; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; }
    .btn:hover { background: #0f766e; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
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
        <a href="${ctx.csatUrl}" class="btn" style="color: #ffffff !important;">Ver Detalles de Entrega</a>
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
    body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 30px; text-align: center; color: white; }
    .header h1 { margin: 0; font-size: 24px; font-family: 'Cabin', 'Segoe UI', sans-serif; }
    .content { padding: 30px; }
    .alert-box { background: #fef3c7; border: 1px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
    .info-label { color: #64748b; }
    .info-value { font-weight: bold; color: #0f172a; }
    .score { font-size: 48px; text-align: center; color: #dc2626; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
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

      <p style="margin-top: 20px; color: #dc2626; font-weight: bold;">
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
    body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); padding: 30px; text-align: center; color: white; }
    .header h1 { margin: 0; font-size: 24px; font-family: 'Cabin', 'Segoe UI', sans-serif; }
    .content { padding: 30px; }
    .driver-box { background: #f0fdfa; border-left: 4px solid #0d9488; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
    .eta-box { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
    .eta-time { font-size: 24px; font-weight: bold; color: #0f766e; }
    .icon { font-size: 48px; text-align: center; margin: 20px 0; }
    .btn { display: inline-block; background: #0d9488; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; }
    .btn:hover { background: #0f766e; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
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
        <p style="margin: 0 0 10px 0; color: #0f766e;"><strong>Chofer asignado:</strong></p>
        <p style="margin: 0; font-size: 18px; font-weight: bold; color: #0f172a;">${ctx.driverName}</p>
      </div>

      <div class="eta-box">
        <p style="margin: 0 0 10px 0; color: #d97706;"><strong>Hora estimada de llegada:</strong></p>
        <div class="eta-time">${ctx.etaRange}</div>
      </div>

      <p>Por favor, asegurate de que haya alguien disponible para recibir el paquete.</p>

      <p style="text-align: center;">
        <a href="${ctx.trackingUrl}" class="btn" style="color: #ffffff !important;">Rastrear Mi Pedido</a>
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
