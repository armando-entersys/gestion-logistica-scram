import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

import { Order } from '../orders/entities/order.entity';
import { RouteStop } from '../route-stops/entities/route-stop.entity';
import { RoutesService } from './routes.service';
import { RoutesController } from './routes.controller';
import { GoogleRoutesService } from '@/common/services/google-routes.service';
import { RouteStopsModule } from '../route-stops/route-stops.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, RouteStop]),
    HttpModule,
    RouteStopsModule,
  ],
  providers: [RoutesService, GoogleRoutesService],
  controllers: [RoutesController],
  exports: [RoutesService],
})
export class RoutesModule {}
