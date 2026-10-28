import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { StaffAuthGuard } from '../auth/staff-auth.guard';
import { TenantGuard, type TenantRequest } from '../tenancy/tenant.guard';
import { AnalyticsService } from './analytics.service';

@Controller('admin/analytics')
@UseGuards(TenantGuard, StaffAuthGuard)
export class AdminAnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('summary')
  summary(@Req() req: TenantRequest) {
    return this.analytics.summary(req.tenantId!);
  }
}
