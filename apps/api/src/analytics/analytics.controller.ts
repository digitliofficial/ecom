import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { TenantGuard, type TenantRequest } from '../tenancy/tenant.guard';
import {
  AnalyticsService,
  type AnalyticsEventInput,
} from './analytics.service';

@Controller('analytics')
@UseGuards(TenantGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post('events')
  ingest(@Req() req: TenantRequest, @Body() body: AnalyticsEventInput) {
    return this.analytics.ingest(req.tenantId!, body ?? {});
  }
}
