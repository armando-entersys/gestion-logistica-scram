import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';

import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { BindAdapter } from './adapters/bind.adapter';
import { OrdersModule } from '../orders/orders.module';
import { ClientsModule } from '../clients/clients.module';
import { ClientAddressesModule } from '../client-addresses/client-addresses.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    BullModule.registerQueue({ name: 'sync' }),
    OrdersModule,
    forwardRef(() => ClientsModule),
    ClientAddressesModule,
  ],
  providers: [SyncService, BindAdapter],
  controllers: [SyncController],
  exports: [SyncService, BindAdapter],
})
export class SyncModule {}
