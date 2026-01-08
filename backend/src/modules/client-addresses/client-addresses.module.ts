import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

import { ClientAddress } from './entities/client-address.entity';
import { ClientAddressesService } from './client-addresses.service';
import { ClientAddressesController } from './client-addresses.controller';
import { GeocodingService } from '@/common/services/geocoding.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClientAddress]),
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
  ],
  controllers: [ClientAddressesController],
  providers: [ClientAddressesService, GeocodingService],
  exports: [ClientAddressesService],
})
export class ClientAddressesModule {}
