import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrdersModule } from './modules/orders/orders.module';
import { RoutesModule } from './modules/routes/routes.module';
import { SyncModule } from './modules/sync/sync.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { HealthModule } from './modules/health/health.module';
import { ClientAddressesModule } from './modules/client-addresses/client-addresses.module';
import { ClientsModule } from './modules/clients/clients.module';
import { PushSubscriptionsModule } from './modules/push-subscriptions/push-subscriptions.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { StorageModule } from './modules/storage/storage.module';

// Configuration
import configuration from './config/configuration';
import { typeOrmConfig } from './config/typeorm.config';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        ...typeOrmConfig(configService),
        autoLoadEntities: true,
        synchronize: false, // Prevent automatic schema changes
        logging: configService.get('database.logging'),
      }),
    }),

    // Rate Limiting (50 requests per minute per IP)
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // BullMQ Queue
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

    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('jwt.secret'),
        signOptions: {
          expiresIn: configService.get('jwt.expiration'),
        },
      }),
    }),

    // Feature Modules
    HealthModule,
    AuthModule,
    UsersModule,
    OrdersModule,
    RoutesModule,
    SyncModule,
    NotificationsModule,
    ClientAddressesModule,
    ClientsModule,
    PushSubscriptionsModule,
    WebhooksModule,
    StorageModule,
  ],
})
export class AppModule { }
