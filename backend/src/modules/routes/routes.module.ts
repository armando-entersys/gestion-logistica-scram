import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Order } from '../orders/entities/order.entity';
import { RoutesService } from './routes.service';
import { RoutesController } from './routes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Order])],
  providers: [RoutesService],
  controllers: [RoutesController],
  exports: [RoutesService],
})
export class RoutesModule {}
