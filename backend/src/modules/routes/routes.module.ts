import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

import { Order } from '../orders/entities/order.entity';
import { RoutesService } from './routes.service';
import { RoutesController } from './routes.controller';
import { GoogleRoutesService } from '@/common/services/google-routes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    HttpModule,
  ],
  providers: [RoutesService, GoogleRoutesService],
  controllers: [RoutesController],
  exports: [RoutesService],
})
export class RoutesModule {}
