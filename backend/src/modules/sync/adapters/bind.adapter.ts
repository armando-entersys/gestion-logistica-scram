import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { CreateOrderDto } from '@/modules/orders/dto';

interface BindOrder {
  ID: string;
  ClientName: string;
  ClientEmail?: string;
  ClientPhone?: string;
  ClientRFC?: string;
  Address: {
    Street?: string;
    Number?: string;
    Neighborhood?: string;
    PostalCode?: string;
    City?: string;
    State?: string;
    Reference?: string;
  };
  TotalAmount: number;
  Observations?: string;
  PromisedDate?: string;
  Status: string;
}

@Injectable()
export class BindAdapter {
  private readonly logger = new Logger(BindAdapter.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl = this.configService.get('bind.apiUrl') || '';
    this.apiKey = this.configService.get('bind.apiKey') || '';
  }

  /**
   * RF-01: Sincronización Controlada con Bind ERP
   * Anti-Corruption Layer: Transforma datos de Bind al modelo interno
   */
  async fetchOrders(): Promise<CreateOrderDto[]> {
    this.logger.log('Fetching orders from Bind ERP...');

    try {
      const response = await firstValueFrom(
        this.httpService.get<{ data: BindOrder[] }>(`${this.apiUrl}/api/Orders`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          params: {
            // RF-01: Solo pedidos con estatus Facturada o Emitida
            status: 'Facturada,Emitida',
          },
        }),
      );

      const bindOrders = response.data.data || [];
      this.logger.log(`Fetched ${bindOrders.length} orders from Bind`);

      // Transform Bind orders to internal format
      return bindOrders.map((order) => this.transformOrder(order));
    } catch (error) {
      this.logger.error('Failed to fetch orders from Bind:', error);
      throw error;
    }
  }

  /**
   * Transforma un pedido de Bind al formato interno de SCRAM
   * Implementa el mapeo definido en MD070 Sección 4.1
   */
  private transformOrder(bindOrder: BindOrder): CreateOrderDto {
    // RF-02: Detectar VIP/Urgente en observaciones
    const observations = (bindOrder.Observations || '').toUpperCase();
    const isVip = observations.includes('VIP') || observations.includes('URGENTE');

    return {
      bindId: bindOrder.ID,
      clientName: this.cleanString(bindOrder.ClientName),
      clientEmail: bindOrder.ClientEmail || '',
      clientPhone: bindOrder.ClientPhone,
      clientRfc: bindOrder.ClientRFC,
      addressRaw: {
        street: bindOrder.Address?.Street || '',
        number: bindOrder.Address?.Number || '',
        neighborhood: bindOrder.Address?.Neighborhood || '',
        postalCode: bindOrder.Address?.PostalCode || '',
        city: bindOrder.Address?.City || '',
        state: bindOrder.Address?.State || '',
        reference: bindOrder.Address?.Reference,
      },
      totalAmount: bindOrder.TotalAmount || 0,
      isVip,
      promisedDate: bindOrder.PromisedDate ? new Date(bindOrder.PromisedDate) : undefined,
    };
  }

  private cleanString(str: string): string {
    return (str || '').trim().toUpperCase();
  }
}
