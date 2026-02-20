import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { UserRole } from '@/common/enums';
import { ClientAddressesService } from './client-addresses.service';
import { CreateClientAddressDto, SetDefaultAddressDto, UpdateClientAddressDto } from './dto';

@ApiTags('client-addresses')
@Controller('client-addresses')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ClientAddressesController {
  constructor(private readonly service: ClientAddressesService) {}

  @Get(':clientNumber')
  @Roles(UserRole.ADMIN, UserRole.PURCHASING, UserRole.SALES, UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Get all addresses for a client' })
  findByClient(@Param('clientNumber') clientNumber: string) {
    return this.service.findByClient(clientNumber);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.PURCHASING)
  @ApiOperation({ summary: 'Create a new client address' })
  create(@Body() dto: CreateClientAddressDto) {
    return this.service.upsertAddress(dto, 'MANUAL');
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.PURCHASING)
  @ApiOperation({ summary: 'Update a client address' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientAddressDto,
  ) {
    return this.service.update(id, dto);
  }

  @Patch(':id/default')
  @Roles(UserRole.ADMIN, UserRole.PURCHASING)
  @ApiOperation({ summary: 'Set address as default for client' })
  setDefault(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetDefaultAddressDto,
  ) {
    return this.service.setDefault(dto.clientNumber, id);
  }

  @Patch(':id/label')
  @Roles(UserRole.ADMIN, UserRole.PURCHASING)
  @ApiOperation({ summary: 'Update address label' })
  updateLabel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('label') label: string,
  ) {
    return this.service.updateLabel(id, label);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.PURCHASING)
  @ApiOperation({ summary: 'Delete a client address' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
