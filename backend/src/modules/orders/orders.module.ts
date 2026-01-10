import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';

import { Order, ShipmentEvidence } from './entities';
import { AddressChangeRequest } from './entities/address-change-request.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { GeocodingService } from '@/common/services/geocoding.service';
import { ClientAddressesModule } from '@/modules/client-addresses/client-addresses.module';
import { ClientsModule } from '@/modules/clients/clients.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, ShipmentEvidence, AddressChangeRequest]),
    BullModule.registerQueue({
      name: 'notifications',
    }),
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
    ClientAddressesModule,
    ClientsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, GeocodingService],
  exports: [OrdersService],
})
export class OrdersModule {}
