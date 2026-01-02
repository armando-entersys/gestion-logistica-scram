import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

import { SyncService } from './sync.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@/common/enums';

@ApiTags('sync')
@Controller('sync')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  /**
   * RF-01: Sincronización manual con Bind ERP
   */
  @Post('bind')
  @Roles(UserRole.PURCHASING, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync orders from Bind ERP' })
  @ApiResponse({ status: 200, description: 'Sync completed successfully' })
  @ApiResponse({ status: 503, description: 'Bind API unavailable - use Excel fallback' })
  syncFromBind() {
    return this.syncService.syncFromBind();
  }

  /**
   * RF-01: Carga manual por Excel (contingencia)
   */
  @Post('excel')
  @Roles(UserRole.PURCHASING, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload orders from Excel (contingency)' })
  @ApiResponse({ status: 200, description: 'Upload completed' })
  syncFromExcel(@Body() body: { orders: any[] }) {
    return this.syncService.syncFromExcel(body.orders);
  }
}
