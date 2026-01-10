import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PushSubscription } from './entities/push-subscription.entity';

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
  actions?: Array<{ action: string; title: string }>;
}

@Injectable()
export class PushSubscriptionsService {
  private readonly logger = new Logger(PushSubscriptionsService.name);
  private vapidConfigured = false;

  constructor(
    @InjectRepository(PushSubscription)
    private readonly subscriptionRepository: Repository<PushSubscription>,
    private readonly configService: ConfigService,
  ) {
    this.initializeVapid();
  }

  private initializeVapid() {
    const vapidPublicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    const vapidSubject = this.configService.get<string>('VAPID_SUBJECT', 'mailto:admin@entersys.mx');

    if (vapidPublicKey && vapidPrivateKey) {
      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
      this.vapidConfigured = true;
      this.logger.log('VAPID keys configured successfully');
    } else {
      this.logger.warn('VAPID keys not configured. Push notifications will not work.');
    }
  }

  /**
   * Get VAPID public key for client subscription
   */
  getPublicKey(): string | null {
    return this.configService.get<string>('VAPID_PUBLIC_KEY') || null;
  }

  /**
   * Subscribe a user to push notifications
   */
  async subscribe(
    userId: string,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    userAgent?: string,
  ): Promise<PushSubscription> {
    // Check if subscription already exists
    const existing = await this.subscriptionRepository.findOne({
      where: { userId, endpoint: subscription.endpoint },
    });

    if (existing) {
      // Update existing subscription
      existing.p256dh = subscription.keys.p256dh;
      existing.auth = subscription.keys.auth;
      existing.userAgent = userAgent;
      existing.isActive = true;
      return this.subscriptionRepository.save(existing);
    }

    // Create new subscription
    const newSubscription = this.subscriptionRepository.create({
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent,
      isActive: true,
    });

    return this.subscriptionRepository.save(newSubscription);
  }

  /**
   * Unsubscribe a user from push notifications
   */
  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.subscriptionRepository.delete({ userId, endpoint });
  }

  /**
   * Deactivate all subscriptions for a user
   */
  async deactivateAllForUser(userId: string): Promise<void> {
    await this.subscriptionRepository.update({ userId }, { isActive: false });
  }

  /**
   * Send push notification to a specific user
   */
  async sendToUser(userId: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
    if (!this.vapidConfigured) {
      this.logger.warn('Cannot send push notification: VAPID not configured');
      return { sent: 0, failed: 0 };
    }

    const subscriptions = await this.subscriptionRepository.find({
      where: { userId, isActive: true },
    });

    if (subscriptions.length === 0) {
      this.logger.debug(`No active subscriptions for user ${userId}`);
      return { sent: 0, failed: 0 };
    }

    const results = await Promise.allSettled(
      subscriptions.map((sub) => this.sendNotification(sub, payload)),
    );

    let sent = 0;
    let failed = 0;
    const invalidSubscriptions: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        sent++;
      } else {
        failed++;
        // If subscription is invalid, mark for removal
        if (this.isInvalidSubscriptionError(result.reason)) {
          invalidSubscriptions.push(subscriptions[index].id);
        }
      }
    });

    // Remove invalid subscriptions
    if (invalidSubscriptions.length > 0) {
      await this.subscriptionRepository.delete(invalidSubscriptions);
      this.logger.log(`Removed ${invalidSubscriptions.length} invalid subscriptions`);
    }

    this.logger.log(`Push notification to user ${userId}: ${sent} sent, ${failed} failed`);
    return { sent, failed };
  }

  /**
   * Send push notification to multiple users
   */
  async sendToUsers(userIds: string[], payload: PushPayload): Promise<{ sent: number; failed: number }> {
    let totalSent = 0;
    let totalFailed = 0;

    for (const userId of userIds) {
      const result = await this.sendToUser(userId, payload);
      totalSent += result.sent;
      totalFailed += result.failed;
    }

    return { sent: totalSent, failed: totalFailed };
  }

  private async sendNotification(subscription: PushSubscription, payload: PushPayload): Promise<void> {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/pwa-192x192.png',
      badge: payload.badge || '/pwa-192x192.png',
      data: payload.data || {},
      actions: payload.actions || [],
      timestamp: Date.now(),
    });

    await webpush.sendNotification(pushSubscription, notificationPayload);
  }

  private isInvalidSubscriptionError(error: any): boolean {
    // HTTP 404 or 410 means the subscription is no longer valid
    return error?.statusCode === 404 || error?.statusCode === 410;
  }
}
