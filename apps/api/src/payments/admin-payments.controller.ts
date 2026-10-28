import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { StaffAuthGuard } from '../auth/staff-auth.guard';
import { TenantGuard, type TenantRequest } from '../tenancy/tenant.guard';
import {
  PaymentsService,
  type PaymentSettingsUpdate,
} from './payments.service';

@Controller('admin/payments')
@UseGuards(TenantGuard, StaffAuthGuard)
export class AdminPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('settings')
  getSettings(@Req() req: TenantRequest) {
    return this.payments.getSettings(req.tenantId!);
  }

  @Patch('settings')
  updateSettings(
    @Req() req: TenantRequest,
    @Body() body: PaymentSettingsUpdate,
  ) {
    return this.payments.updateSettings(req.tenantId!, body ?? {});
  }
}
