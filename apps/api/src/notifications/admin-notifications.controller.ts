import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { StaffAuthGuard } from '../auth/staff-auth.guard';
import { TenantGuard, type TenantRequest } from '../tenancy/tenant.guard';
import { AbandonedCartService } from './abandoned-cart.service';
import {
  NotificationsService,
  type NotificationSettingsUpdate,
} from './notifications.service';

@Controller('admin/notifications')
@UseGuards(TenantGuard, StaffAuthGuard)
export class AdminNotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly abandonedCart: AbandonedCartService,
  ) {}

  @Get('settings')
  getSettings(@Req() req: TenantRequest) {
    return this.notifications.getSettings(req.tenantId!);
  }

  @Patch('settings')
  updateSettings(
    @Req() req: TenantRequest,
    @Body() body: NotificationSettingsUpdate,
  ) {
    return this.notifications.updateSettings(req.tenantId!, body ?? {});
  }

  /** Manual trigger for local demos / ops — runs abandon scan then outbox drain. */
  @Post('process')
  async processNow() {
    const abandonedQueued = await this.abandonedCart.processDueCarts();
    const emailsSent = await this.notifications.processOutbox();
    return { abandonedQueued, emailsSent };
  }
}
