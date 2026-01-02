import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { BindAdapter } from './adapters/bind.adapter';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    OrdersModule,
  ],
  providers: [SyncService, BindAdapter],
  controllers: [SyncController],
  exports: [SyncService],
})
export class SyncModule {}
