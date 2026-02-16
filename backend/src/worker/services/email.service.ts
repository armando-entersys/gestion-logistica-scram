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

  // SCRAM Brand Assets
  private readonly SCRAM_LOGO = 'https://storage.googleapis.com/scram-evidence/assets/scram_logotipo_vnegativa.png';
  private readonly SCRAM_WEBSITE = 'https://scram2k.com';
  private readonly SCRAM_SUPPORT = 'https://scram2k.com/soporte/';
  private readonly SCRAM_FACEBOOK = 'https://www.facebook.com/scram2k';
  private readonly SCRAM_TWITTER = 'https://x.com/scramnet';
  private readonly SCRAM_INSTAGRAM = 'https://www.instagram.com/scramnet/';
  private readonly SCRAM_LINKEDIN = 'https://www.linkedin.com/company/scram2k/';
  private readonly SCRAM_PHONE = '+52 55 1113 0259';
  private readonly SCRAM_EMAIL = 'contacto@scram2k.com';

  // Brand Colors
  private readonly COLOR_ORANGE = '#ff9900';
  private readonly COLOR_DARK_BLUE = '#0e314c';
  private readonly COLOR_GRAY_BLUE = '#6084a4';
  private readonly COLOR_GREEN = '#44ce6f';

  constructor(private readonly configService: ConfigService) {
    this.from = this.configService.get('sendgrid.from') || 'no-reply@scram2k.com';

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
    const html = this.renderTemplate(options.template, options.context);

    try {
      const info = await this.transporter.sendMail({
        from: `"SCRAM Logistica" <${this.from}>`,
        to: options.to,
        subject: options.subject,
        html: html,
      });

      this.logger.log(`Email sent to ${options.to} - MessageId: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}:`, error);
      throw error;
    }
  }

  private renderTemplate(template: string, context: Record<string, any>): string {
    const templates: Record<string, (ctx: any) => string> = {
      'eta-notification': this.etaNotificationTemplate.bind(this),
      'delivery-confirmation': this.deliveryConfirmationTemplate.bind(this),
      'detractor-alert': this.detractorAlertTemplate.bind(this),
      'en-route-notification': this.enRouteNotificationTemplate.bind(this),
      'password-reset': this.passwordResetTemplate.bind(this),
      'carrier-shipment': this.carrierShipmentTemplate.bind(this),
    };

    const templateFn = templates[template];
    if (!templateFn) {
      throw new Error(`Unknown email template: ${template}`);
    }

    return templateFn(context);
  }

  private getEmailStyles(): string {
    return `
    <style>
      body {
        font-family: 'Segoe UI', Arial, sans-serif;
        background-color: #f5f7fa;
        margin: 0;
        padding: 20px;
        line-height: 1.6;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        background: white;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(14, 49, 76, 0.1);
      }
      .header {
        background: linear-gradient(135deg, ${this.COLOR_DARK_BLUE} 0%, #1a4a6e 100%);
        padding: 30px;
        text-align: center;
      }
      .header img {
        max-width: 180px;
        height: auto;
        margin-bottom: 15px;
      }
      .header h1 {
        margin: 0;
        font-size: 24px;
        color: white;
        font-weight: 600;
      }
      .header-accent {
        width: 100%;
        height: 4px;
        background: linear-gradient(90deg, ${this.COLOR_ORANGE} 0%, ${this.COLOR_GREEN} 100%);
      }
      .content {
        padding: 35px 30px;
        color: #333;
      }
      .content p {
        margin: 0 0 15px 0;
      }
      .highlight-box {
        background: linear-gradient(135deg, #fff8f0 0%, #fff5e6 100%);
        border-left: 4px solid ${this.COLOR_ORANGE};
        padding: 20px;
        margin: 25px 0;
        border-radius: 0 10px 10px 0;
      }
      .info-box {
        background: #f0f7ff;
        border-left: 4px solid ${this.COLOR_DARK_BLUE};
        padding: 20px;
        margin: 25px 0;
        border-radius: 0 10px 10px 0;
      }
      .success-box {
        background: linear-gradient(135deg, #f0fff4 0%, #e6ffed 100%);
        border-left: 4px solid ${this.COLOR_GREEN};
        padding: 20px;
        margin: 25px 0;
        border-radius: 0 10px 10px 0;
      }
      .alert-box {
        background: #fff5f5;
        border-left: 4px solid #e53e3e;
        padding: 20px;
        margin: 25px 0;
        border-radius: 0 10px 10px 0;
      }
      .eta-time {
        font-size: 28px;
        font-weight: bold;
        color: ${this.COLOR_DARK_BLUE};
      }
      .btn {
        display: inline-block;
        background: linear-gradient(135deg, ${this.COLOR_ORANGE} 0%, #e68a00 100%);
        color: white !important;
        padding: 14px 35px;
        text-decoration: none;
        border-radius: 8px;
        font-weight: bold;
        margin-top: 20px;
        box-shadow: 0 4px 15px rgba(255, 153, 0, 0.3);
        transition: all 0.3s ease;
      }
      .btn:hover {
        background: linear-gradient(135deg, #e68a00 0%, ${this.COLOR_ORANGE} 100%);
        box-shadow: 0 6px 20px rgba(255, 153, 0, 0.4);
      }
      .btn-secondary {
        background: linear-gradient(135deg, ${this.COLOR_DARK_BLUE} 0%, #1a4a6e 100%);
        box-shadow: 0 4px 15px rgba(14, 49, 76, 0.3);
      }
      .stars {
        text-align: center;
        margin: 25px 0;
      }
      .star {
        display: inline-block;
        width: 45px;
        height: 45px;
        line-height: 45px;
        font-size: 18px;
        font-weight: bold;
        color: ${this.COLOR_DARK_BLUE};
        text-decoration: none;
        margin: 0 5px;
        background: #f0f4f8;
        border-radius: 50%;
        transition: all 0.3s ease;
      }
      .star:hover {
        background: ${this.COLOR_ORANGE};
        color: white;
        transform: scale(1.1);
      }
      .info-row {
        display: flex;
        justify-content: space-between;
        padding: 12px 0;
        border-bottom: 1px solid #e8ecf0;
      }
      .info-row:last-child {
        border-bottom: none;
      }
      .info-label {
        color: ${this.COLOR_GRAY_BLUE};
      }
      .info-value {
        font-weight: 600;
        color: ${this.COLOR_DARK_BLUE};
      }
      .score {
        font-size: 56px;
        text-align: center;
        color: #e53e3e;
        font-weight: bold;
      }
      .footer {
        background: ${this.COLOR_DARK_BLUE};
        padding: 30px;
        text-align: center;
        color: white;
      }
      .footer-logo {
        max-width: 120px;
        margin-bottom: 15px;
      }
      .footer p {
        margin: 5px 0;
        font-size: 13px;
        color: rgba(255,255,255,0.8);
      }
      .footer a {
        color: ${this.COLOR_ORANGE};
        text-decoration: none;
      }
      .footer a:hover {
        text-decoration: underline;
      }
      .social-links {
        margin: 20px 0;
      }
      .social-links a {
        display: inline-block;
        width: 36px;
        height: 36px;
        line-height: 36px;
        background: rgba(255,255,255,0.1);
        border-radius: 50%;
        margin: 0 6px;
        transition: all 0.3s ease;
      }
      .social-links a:hover {
        background: ${this.COLOR_ORANGE};
      }
      .social-links img {
        width: 18px;
        height: 18px;
        vertical-align: middle;
      }
      .divider {
        height: 1px;
        background: rgba(255,255,255,0.2);
        margin: 20px 0;
      }
      .contact-info {
        font-size: 12px;
        color: rgba(255,255,255,0.6);
      }
    </style>`;
  }

  private getEmailHeader(title: string): string {
    return `
    <div class="header">
      <img src="${this.SCRAM_LOGO}" alt="SCRAM" />
      <h1>${title}</h1>
    </div>
    <div class="header-accent"></div>`;
  }

  private getEmailFooter(): string {
    return `
    <div class="footer">
      <img src="${this.SCRAM_LOGO}" alt="SCRAM" class="footer-logo" />

      <div class="social-links">
        <a href="${this.SCRAM_FACEBOOK}" title="Facebook">
          <img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" alt="Facebook" />
        </a>
        <a href="${this.SCRAM_INSTAGRAM}" title="Instagram">
          <img src="https://cdn-icons-png.flaticon.com/512/733/733558.png" alt="Instagram" />
        </a>
        <a href="${this.SCRAM_TWITTER}" title="X (Twitter)">
          <img src="https://cdn-icons-png.flaticon.com/512/733/733579.png" alt="X" />
        </a>
        <a href="${this.SCRAM_LINKEDIN}" title="LinkedIn">
          <img src="https://cdn-icons-png.flaticon.com/512/733/733561.png" alt="LinkedIn" />
        </a>
      </div>

      <div class="divider"></div>

      <p>SCRAM - Software empresarial que funciona</p>
      <p><a href="${this.SCRAM_WEBSITE}">www.scram2k.com</a></p>

      <div class="divider"></div>

      <p class="contact-info">
        <a href="tel:${this.SCRAM_PHONE}">${this.SCRAM_PHONE}</a> |
        <a href="mailto:${this.SCRAM_EMAIL}">${this.SCRAM_EMAIL}</a>
      </p>
      <p class="contact-info" style="margin-top: 15px;">
        <a href="${this.SCRAM_SUPPORT}">Necesitas ayuda? Contacta a Soporte</a>
      </p>
    </div>`;
  }

  private etaNotificationTemplate(ctx: any): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tu pedido va en camino</title>
  ${this.getEmailStyles()}
</head>
<body>
  <div class="container">
    ${this.getEmailHeader('Tu pedido va en camino!')}
    <div class="content">
      <p>Hola <strong>${ctx.clientName}</strong>,</p>
      <p>Buenas noticias: tu pedido ha salido de nuestro almacen y esta en camino hacia ti.</p>

      <div class="info-box">
        <p style="margin: 0 0 10px 0; color: ${this.COLOR_GRAY_BLUE};"><strong>Tu chofer asignado:</strong></p>
        <p style="margin: 0; font-size: 18px; font-weight: bold; color: ${this.COLOR_DARK_BLUE};">${ctx.driverName}</p>
      </div>

      <div class="highlight-box">
        <p style="margin: 0 0 10px 0; color: #996600;"><strong>Hora Estimada de Llegada:</strong></p>
        <div class="eta-time">${ctx.etaRange}</div>
        <p style="margin: 10px 0 0 0; font-size: 14px; color: ${this.COLOR_GRAY_BLUE};">Parada #${ctx.routePosition} de la ruta</p>
      </div>

      <p>Por favor, asegurate de que haya alguien disponible para recibir el paquete.</p>

      <p style="text-align: center;">
        <a href="${ctx.trackingUrl}" class="btn">Ver Estatus en Tiempo Real</a>
      </p>
    </div>
    ${this.getEmailFooter()}
  </div>
</body>
</html>`;
  }

  private deliveryConfirmationTemplate(ctx: any): string {
    // URL base para calificar desde email (guarda en BD y redirige)
    const apiUrl = process.env.API_URL || 'https://api-gestion-logistica.scram2k.com';
    const rateUrl = `${apiUrl}/api/v1/orders/rate/${ctx.trackingHash}`;

    // URLs de imágenes de caritas (usando emojis de Twemoji - Twitter's emoji library)
    const emojiImages = {
      angry: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f621.png',      // 😡
      sad: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f61e.png',        // 😞
      neutral: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f610.png',    // 😐
      happy: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f60a.png',      // 😊
      love: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f60d.png',       // 😍
    };

    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pedido Entregado</title>
  ${this.getEmailStyles()}
  <style>
    .emoji-rating {
      text-align: center;
      margin: 25px 0;
    }
    .emoji-btn {
      display: inline-block;
      width: 60px;
      height: 60px;
      text-decoration: none;
      margin: 0 6px;
      background: #f5f7fa;
      border-radius: 50%;
      padding: 8px;
      box-sizing: border-box;
    }
    .emoji-btn:hover {
      background: #e8ecf0;
    }
    .emoji-btn img {
      width: 44px;
      height: 44px;
    }
    .emoji-label {
      display: block;
      font-size: 11px;
      color: ${this.COLOR_GRAY_BLUE};
      margin-top: 8px;
    }
    .emoji-container {
      display: inline-block;
      text-align: center;
      margin: 0 4px;
      vertical-align: top;
    }
  </style>
</head>
<body>
  <div class="container">
    ${this.getEmailHeader('Pedido Entregado!')}
    <div class="content">
      <p>Hola <strong>${ctx.clientName}</strong>,</p>
      <p>Confirmamos que tu pedido <strong>${ctx.invoiceNumber || ''}</strong> ha sido entregado exitosamente.</p>

      <div class="success-box">
        <p style="margin: 0; text-align: center; font-size: 16px;">
          <strong>Gracias por tu preferencia!</strong>
        </p>
      </div>

      <p style="text-align: center; margin: 30px 0 10px 0; font-size: 18px;"><strong>Como fue tu experiencia?</strong></p>
      <p style="text-align: center; color: ${this.COLOR_GRAY_BLUE}; font-size: 14px; margin-bottom: 25px;">Haz clic en una carita para calificar tu entrega</p>

      <div class="emoji-rating">
        <div class="emoji-container">
          <a href="${rateUrl}?score=1" class="emoji-btn" title="1 - Muy malo" style="font-size:28px;font-weight:bold;color:#e53e3e;text-decoration:none;">
            <img src="${emojiImages.angry}" alt="1" width="44" height="44" style="vertical-align:middle;" />
          </a>
          <span class="emoji-label">Muy malo</span>
        </div>
        <div class="emoji-container">
          <a href="${rateUrl}?score=2" class="emoji-btn" title="2 - Malo" style="font-size:28px;font-weight:bold;color:#ed8936;text-decoration:none;">
            <img src="${emojiImages.sad}" alt="2" width="44" height="44" style="vertical-align:middle;" />
          </a>
          <span class="emoji-label">Malo</span>
        </div>
        <div class="emoji-container">
          <a href="${rateUrl}?score=3" class="emoji-btn" title="3 - Regular" style="font-size:28px;font-weight:bold;color:#718096;text-decoration:none;">
            <img src="${emojiImages.neutral}" alt="3" width="44" height="44" style="vertical-align:middle;" />
          </a>
          <span class="emoji-label">Regular</span>
        </div>
        <div class="emoji-container">
          <a href="${rateUrl}?score=4" class="emoji-btn" title="4 - Bueno" style="font-size:28px;font-weight:bold;color:#48bb78;text-decoration:none;">
            <img src="${emojiImages.happy}" alt="4" width="44" height="44" style="vertical-align:middle;" />
          </a>
          <span class="emoji-label">Bueno</span>
        </div>
        <div class="emoji-container">
          <a href="${rateUrl}?score=5" class="emoji-btn" title="5 - Excelente" style="font-size:28px;font-weight:bold;color:#38a169;text-decoration:none;">
            <img src="${emojiImages.love}" alt="5" width="44" height="44" style="vertical-align:middle;" />
          </a>
          <span class="emoji-label">Excelente</span>
        </div>
      </div>

      <p style="text-align: center; margin-top: 30px;">
        <a href="${ctx.csatUrl}" class="btn btn-secondary">Ver Detalles de Mi Entrega</a>
      </p>
    </div>
    ${this.getEmailFooter()}
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
  ${this.getEmailStyles()}
  <style>
    .header {
      background: linear-gradient(135deg, #c53030 0%, #9b2c2c 100%) !important;
    }
  </style>
</head>
<body>
  <div class="container">
    ${this.getEmailHeader('ALERTA: Calificacion Negativa')}
    <div class="content">
      <div class="score">${ctx.score}/5</div>
      <p style="text-align: center; color: ${this.COLOR_GRAY_BLUE}; margin-bottom: 25px;">El cliente ha reportado una experiencia negativa</p>

      <div class="alert-box">
        <p style="margin: 0 0 10px 0;"><strong>Comentario del cliente:</strong></p>
        <p style="margin: 0; font-style: italic; color: #333;">"${ctx.feedback || 'Sin comentarios adicionales'}"</p>
      </div>

      <h3 style="color: ${this.COLOR_DARK_BLUE}; margin-bottom: 15px;">Detalles del Pedido</h3>
      <div style="background: #f8fafc; border-radius: 8px; padding: 5px 15px;">
        <div class="info-row">
          <span class="info-label">Cliente:</span>
          <span class="info-value">${ctx.clientName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">No. Pedido:</span>
          <span class="info-value">${ctx.orderNumber || ctx.orderId}</span>
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
      </div>

      <div class="highlight-box" style="background: #fff5f5; border-color: #e53e3e; margin-top: 25px;">
        <p style="margin: 0; color: #c53030; font-weight: bold;">
          Accion Requerida: Contactar al cliente dentro de las proximas 24 horas para seguimiento y resolucion.
        </p>
      </div>
    </div>
    ${this.getEmailFooter()}
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
  ${this.getEmailStyles()}
</head>
<body>
  <div class="container">
    ${this.getEmailHeader('Tu pedido esta en camino!')}
    <div class="content">
      <p>Hola <strong>${ctx.clientName}</strong>,</p>
      <p>Te informamos que nuestro chofer ya salio a entregar tu pedido.</p>

      <div class="info-box">
        <p style="margin: 0 0 10px 0; color: ${this.COLOR_GRAY_BLUE};"><strong>Chofer asignado:</strong></p>
        <p style="margin: 0; font-size: 18px; font-weight: bold; color: ${this.COLOR_DARK_BLUE};">${ctx.driverName}</p>
      </div>

      <div class="highlight-box">
        <p style="margin: 0 0 10px 0; color: #996600;"><strong>Hora estimada de llegada:</strong></p>
        <div class="eta-time">${ctx.etaRange}</div>
      </div>

      <p>Por favor, asegurate de que haya alguien disponible para recibir el paquete.</p>

      <p style="text-align: center;">
        <a href="${ctx.trackingUrl}" class="btn">Rastrear Mi Pedido</a>
      </p>
    </div>
    ${this.getEmailFooter()}
  </div>
</body>
</html>`;
  }

  private passwordResetTemplate(ctx: any): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Restablecer Contrasena</title>
  ${this.getEmailStyles()}
</head>
<body>
  <div class="container">
    ${this.getEmailHeader('Restablecer Contrasena')}
    <div class="content">
      <p>Hola <strong>${ctx.userName}</strong>,</p>
      <p>Recibimos una solicitud para restablecer la contrasena de tu cuenta en el Sistema de Gestion Logistica SCRAM.</p>

      <div class="info-box">
        <p style="margin: 0 0 10px 0; color: ${this.COLOR_GRAY_BLUE};">Si tu solicitaste este cambio, haz clic en el boton de abajo:</p>
      </div>

      <p style="text-align: center;">
        <a href="${ctx.resetUrl}" class="btn">Restablecer Mi Contrasena</a>
      </p>

      <div class="highlight-box" style="margin-top: 30px;">
        <p style="margin: 0; font-size: 14px; color: #996600;">
          <strong>Este enlace expira en 1 hora.</strong><br><br>
          Si no solicitaste restablecer tu contrasena, puedes ignorar este correo. Tu cuenta permanecera segura.
        </p>
      </div>

      <p style="margin-top: 25px; font-size: 13px; color: ${this.COLOR_GRAY_BLUE};">
        Si el boton no funciona, copia y pega este enlace en tu navegador:<br>
        <a href="${ctx.resetUrl}" style="color: ${this.COLOR_ORANGE}; word-break: break-all;">${ctx.resetUrl}</a>
      </p>
    </div>
    ${this.getEmailFooter()}
  </div>
</body>
</html>`;
  }

  private carrierShipmentTemplate(ctx: any): string {
    const isProvider = ctx.isProvider;

    const carrierInfoBox = isProvider
      ? `<div class="info-box">
          <p style="margin: 0 0 10px 0; color: ${this.COLOR_GRAY_BLUE};"><strong>Enviado por:</strong></p>
          <p style="margin: 0; font-size: 20px; font-weight: bold; color: ${this.COLOR_DARK_BLUE};">SCRAM</p>
          <p style="margin: 10px 0 0 0; font-size: 14px;">Nosotros nos encargamos de la entrega y el seguimiento de tu pedido.</p>
        </div>`
      : `<div class="info-box">
          <p style="margin: 0 0 10px 0; color: ${this.COLOR_GRAY_BLUE};"><strong>Servicio de paqueteria:</strong></p>
          <p style="margin: 0; font-size: 20px; font-weight: bold; color: ${this.COLOR_DARK_BLUE};">${ctx.carrierName}</p>
          ${ctx.trackingNumber && ctx.trackingNumber !== 'Pendiente' ? `<p style="margin: 10px 0 0 0; font-size: 14px;">No. de guia: <strong>${ctx.trackingNumber}</strong></p>` : ''}
        </div>`;

    const bodyText = isProvider
      ? `Te informamos que tu pedido esta en camino. <strong>SCRAM</strong> se encarga de la entrega y seguimiento.`
      : `Te informamos que tu pedido ha sido enviado a traves de <strong>${ctx.carrierName}</strong> y esta en camino hacia ti.`;

    const footerText = isProvider
      ? `Tu pedido sera entregado por <strong>SCRAM</strong>. Por favor, asegurate de que haya alguien disponible para recibir el paquete.`
      : `Tu pedido sera entregado por <strong>SCRAM</strong> a traves de ${ctx.carrierName}. Por favor, asegurate de que haya alguien disponible para recibir el paquete.`;

    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tu pedido fue enviado</title>
  ${this.getEmailStyles()}
</head>
<body>
  <div class="container">
    ${this.getEmailHeader('Tu pedido fue enviado!')}
    <div class="content">
      <p>Hola <strong>${ctx.clientName}</strong>,</p>
      <p>${bodyText}</p>

      ${carrierInfoBox}

      <div class="highlight-box">
        <p style="margin: 0 0 10px 0; color: #996600;"><strong>Fecha estimada de entrega:</strong></p>
        <div class="eta-time" style="font-size: 22px;">${ctx.deliveryInfo}</div>
      </div>

      <p>${footerText}</p>

      <p style="text-align: center;">
        <a href="${ctx.trackingUrl}" class="btn">Ver Estado de Mi Pedido</a>
      </p>
    </div>
    ${this.getEmailFooter()}
  </div>
</body>
</html>`;
  }
}
