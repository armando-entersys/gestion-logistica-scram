import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PickupPoint } from './entities/pickup-point.entity';
import { RouteStop } from './entities/route-stop.entity';
import { RouteStopsService } from './route-stops.service';
import { RouteStopsController } from './route-stops.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PickupPoint, RouteStop]),
    StorageModule,
  ],
  providers: [RouteStopsService],
  controllers: [RouteStopsController],
  exports: [RouteStopsService],
})
export class RouteStopsModule {}
