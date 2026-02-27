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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@/common/enums';

import { RouteStopsService } from './route-stops.service';
import {
  CreatePickupPointDto,
  UpdatePickupPointDto,
  CreateRouteStopDto,
  CompleteRouteStopDto,
  DispatchStopsDto,
} from './dto';

@ApiTags('route-stops')
@Controller('route-stops')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RouteStopsController {
  constructor(private readonly routeStopsService: RouteStopsService) {}

  // ── Pickup Points ────────────────────────────────────────

  @Get('pickup-points')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.PURCHASING)
  @ApiOperation({ summary: 'List pickup points (optionally filter by clientId)' })
  findAllPickupPoints(@Query('clientId') clientId?: string) {
    return this.routeStopsService.findAllPickupPoints(clientId);
  }

  @Get('pickup-points/search')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.PURCHASING)
  @ApiOperation({ summary: 'Search pickup points by name/address' })
  searchPickupPoints(@Query('q') query: string) {
    return this.routeStopsService.searchPickupPoints(query || '');
  }

  @Post('pickup-points')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.PURCHASING)
  @ApiOperation({ summary: 'Create a new pickup point' })
  createPickupPoint(@Body() dto: CreatePickupPointDto) {
    return this.routeStopsService.createPickupPoint(dto);
  }

  @Patch('pickup-points/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.PURCHASING)
  @ApiOperation({ summary: 'Update a pickup point' })
  updatePickupPoint(@Param('id') id: string, @Body() dto: UpdatePickupPointDto) {
    return this.routeStopsService.updatePickupPoint(id, dto);
  }

  @Delete('pickup-points/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.PURCHASING)
  @ApiOperation({ summary: 'Deactivate a pickup point' })
  deletePickupPoint(@Param('id') id: string) {
    return this.routeStopsService.deletePickupPoint(id);
  }

  // ── Route Stops ──────────────────────────────────────────

  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.PURCHASING)
  @ApiOperation({ summary: 'Get pending route stops for planning' })
  getPendingStops() {
    return this.routeStopsService.getPendingRouteStops();
  }

  @Get('completed')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.PURCHASING)
  @ApiOperation({ summary: 'Get completed/cancelled route stops' })
  getCompletedStops() {
    return this.routeStopsService.getCompletedRouteStops();
  }

  @Get('in-transit')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.PURCHASING)
  @ApiOperation({ summary: 'Get in-transit route stops' })
  getInTransitStops() {
    return this.routeStopsService.getInTransitRouteStops();
  }

  @Get('my-stops')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Get current driver assigned stops' })
  getMyStops(@CurrentUser('id') driverId: string) {
    return this.routeStopsService.getRouteStopsByDriver(driverId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.PURCHASING)
  @ApiOperation({ summary: 'Create a route stop' })
  createRouteStop(@Body() dto: CreateRouteStopDto) {
    return this.routeStopsService.createRouteStop(dto);
  }

  @Patch(':id/complete')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Complete a route stop (driver)' })
  completeRouteStop(
    @Param('id') id: string,
    @CurrentUser('id') driverId: string,
    @Body() dto: CompleteRouteStopDto,
  ) {
    return this.routeStopsService.completeRouteStop(id, driverId, dto);
  }

  @Post('dispatch')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.PURCHASING)
  @ApiOperation({ summary: 'Dispatch route stops to a driver' })
  dispatchStops(@Body() dto: DispatchStopsDto) {
    return this.routeStopsService.dispatchStops(dto.stopIds, dto.driverId);
  }

  @Patch(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.PURCHASING)
  @ApiOperation({ summary: 'Cancel a route stop (admin)' })
  cancelRouteStop(@Param('id') id: string) {
    return this.routeStopsService.cancelRouteStop(id);
  }
}
