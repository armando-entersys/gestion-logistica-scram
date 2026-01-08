import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { UserRole } from '@/common/enums';
import { ClientsService } from './clients.service';
import { CreateClientDto, UpdateClientDto, ClientFilterDto } from './dto';

@ApiTags('clients')
@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ClientsController {
  constructor(private readonly service: ClientsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.PURCHASING, UserRole.SALES, UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Get all clients with pagination' })
  findAll(@Query() filters: ClientFilterDto) {
    return this.service.findAll(filters);
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.PURCHASING, UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Get client statistics' })
  getStats() {
    return this.service.getStats();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.PURCHASING, UserRole.SALES, UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Get client by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Get('number/:clientNumber')
  @Roles(UserRole.ADMIN, UserRole.PURCHASING, UserRole.SALES, UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Get client by client number' })
  findByClientNumber(@Param('clientNumber') clientNumber: string) {
    return this.service.findByClientNumber(clientNumber);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.PURCHASING)
  @ApiOperation({ summary: 'Create a new client' })
  create(@Body() dto: CreateClientDto) {
    return this.service.upsertClient(dto, 'MANUAL');
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.PURCHASING)
  @ApiOperation({ summary: 'Update client' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete client' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
