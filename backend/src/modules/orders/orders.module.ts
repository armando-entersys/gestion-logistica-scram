import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';

import { Order, ShipmentEvidence } from './entities';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { GeocodingService } from '@/common/services/geocoding.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, ShipmentEvidence]),
    BullModule.registerQueue({
      name: 'notifications',
    }),
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, GeocodingService],
  exports: [OrdersService],
})
export class OrdersModule {}
