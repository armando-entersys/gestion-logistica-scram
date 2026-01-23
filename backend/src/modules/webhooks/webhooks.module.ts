import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';

import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { BindWebhookService } from './bind-webhook.service';
import { SyncModule } from '../sync/sync.module';
import { OrdersModule } from '../orders/orders.module';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    BullModule.registerQueue({ name: 'sync' }),
    forwardRef(() => SyncModule),
    forwardRef(() => OrdersModule),
    forwardRef(() => ClientsModule),
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService, BindWebhookService],
  exports: [WebhooksService, BindWebhookService],
})
export class WebhooksModule {}
