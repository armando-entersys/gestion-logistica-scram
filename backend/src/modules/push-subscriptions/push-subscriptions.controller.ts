import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  UseGuards,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PushSubscriptionsService } from './push-subscriptions.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';

class SubscribeDto {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

class UnsubscribeDto {
  endpoint: string;
}

@ApiTags('push')
@Controller('push')
export class PushSubscriptionsController {
  constructor(private readonly pushService: PushSubscriptionsService) {}

  /**
   * Get VAPID public key for client subscription
   */
  @Get('vapid-key')
  @ApiOperation({ summary: 'Get VAPID public key for push subscription' })
  getVapidKey() {
    const key = this.pushService.getPublicKey();
    if (!key) {
      return { configured: false, key: null };
    }
    return { configured: true, key };
  }

  /**
   * Subscribe to push notifications
   */
  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Subscribe to push notifications' })
  async subscribe(
    @CurrentUser('id') userId: string,
    @Body() dto: SubscribeDto,
    @Headers('user-agent') userAgent: string,
  ) {
    const subscription = await this.pushService.subscribe(userId, dto, userAgent);
    return { success: true, subscriptionId: subscription.id };
  }

  /**
   * Unsubscribe from push notifications
   */
  @Delete('unsubscribe')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unsubscribe from push notifications' })
  async unsubscribe(
    @CurrentUser('id') userId: string,
    @Body() dto: UnsubscribeDto,
  ) {
    await this.pushService.unsubscribe(userId, dto.endpoint);
    return { success: true };
  }
}
