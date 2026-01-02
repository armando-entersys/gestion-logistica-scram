import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import configuration from '@/config/configuration';
import { typeOrmConfig } from '@/config/typeorm.config';

import { Order } from '@/modules/orders/entities/order.entity';
import { User } from '@/modules/users/entities/user.entity';

import { EmailProcessor } from './processors/email.processor';
import { EmailService } from './services/email.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: typeOrmConfig,
    }),

    TypeOrmModule.forFeature([Order, User]),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('redis.host'),
          port: configService.get('redis.port'),
        },
      }),
    }),

    BullModule.registerQueue({
      name: 'notifications',
    }),
  ],
  providers: [EmailProcessor, EmailService],
})
export class WorkerModule {}
