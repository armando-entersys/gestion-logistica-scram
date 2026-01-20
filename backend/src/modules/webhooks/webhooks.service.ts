import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * Servicio para gestionar suscripciones a webhooks de Bind ERP
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private readonly bindApiUrl: string;
  private readonly bindApiKey: string;
  private readonly appBaseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.bindApiUrl = this.configService.get('bind.apiUrl') || 'https://api.bind.com.mx';
    this.bindApiKey = this.configService.get('bind.apiKey') || '';
    this.appBaseUrl = this.configService.get('app.baseUrl') || 'https://api-gestion-logistica.scram2k.com';
  }

  /**
   * Obtiene la lista de suscripciones activas a webhooks de Bind
   */
  async getBindSubscriptions(): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.bindApiUrl}/api/WebHooks/Subscriptions`, {
          headers: {
            Authorization: `Bearer ${this.bindApiKey}`,
            'Content-Type': 'application/json',
          },
        }),
      );
      return {
        success: true,
        subscriptions: response.data,
      };
    } catch (error) {
      this.logger.error(`Error obteniendo suscripciones: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Suscribe a un webhook de Bind
   * @param webhookId ID del webhook (ej: 'Add_Invoice')
   * @param targetUrl URL donde Bind enviará las notificaciones
   */
  async subscribeToBindWebhook(
    webhookId: string,
    targetUrl?: string,
  ): Promise<{ success: boolean; message: string; subscriptionId?: string }> {
    const url = targetUrl || `${this.appBaseUrl}/api/v1/webhooks/bind/invoice`;

    this.logger.log(`Suscribiendo a webhook ${webhookId} -> ${url}`);

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.bindApiUrl}/api/WebHooks/Subscriptions`,
          {
            WebHookID: webhookId,
            TargetUrl: url,
          },
          {
            headers: {
              Authorization: `Bearer ${this.bindApiKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      this.logger.log(`Suscripción exitosa a ${webhookId}`);
      return {
        success: true,
        message: `Suscrito exitosamente a ${webhookId}`,
        subscriptionId: response.data?.ID || response.data,
      };
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      this.logger.error(`Error suscribiendo a ${webhookId}: ${errorMessage}`);
      return {
        success: false,
        message: `Error al suscribir: ${errorMessage}`,
      };
    }
  }

  /**
   * Cancela una suscripción a webhook de Bind
   */
  async unsubscribeFromBindWebhook(subscriptionId: string): Promise<{ success: boolean; message: string }> {
    try {
      await firstValueFrom(
        this.httpService.delete(`${this.bindApiUrl}/api/WebHooks/Subscriptions/${subscriptionId}`, {
          headers: {
            Authorization: `Bearer ${this.bindApiKey}`,
            'Content-Type': 'application/json',
          },
        }),
      );

      return {
        success: true,
        message: `Suscripción ${subscriptionId} cancelada`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error al cancelar: ${error.message}`,
      };
    }
  }

  /**
   * Lista todos los webhooks disponibles en Bind
   */
  async getAvailableWebhooks(): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.bindApiUrl}/api/WebHooks`, {
          headers: {
            Authorization: `Bearer ${this.bindApiKey}`,
            'Content-Type': 'application/json',
          },
        }),
      );
      return {
        success: true,
        webhooks: response.data.value || response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
