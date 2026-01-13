import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';

import configuration from '@/config/configuration';
import { typeOrmConfig } from '@/config/typeorm.config';

import { Order } from '@/modules/orders/entities/order.entity';
import { User } from '@/modules/users/entities/user.entity';
import { Client } from '@/modules/clients/entities/client.entity';
import { ClientAddress } from '@/modules/client-addresses/entities/client-address.entity';

import { EmailProcessor } from './processors/email.processor';
import { SyncProcessor } from './processors/sync.processor';
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

    TypeOrmModule.forFeature([Order, User, Client, ClientAddress]),

    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),

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

    BullModule.registerQueue(
      { name: 'notifications' },
      { name: 'sync' },
    ),
  ],
  providers: [EmailProcessor, SyncProcessor, EmailService],
})
export class WorkerModule {}
