import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Client } from './entities/client.entity';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { ClientAddressesModule } from '../client-addresses/client-addresses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Client]),
    forwardRef(() => ClientAddressesModule),
  ],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
