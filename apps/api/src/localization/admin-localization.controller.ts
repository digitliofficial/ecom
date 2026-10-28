import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { StaffAuthGuard } from '../auth/staff-auth.guard';
import { TenantGuard, type TenantRequest } from '../tenancy/tenant.guard';
import {
  LocalizationService,
  type LocalizationSettingsUpdate,
} from './localization.service';

@Controller('admin/localization')
@UseGuards(TenantGuard, StaffAuthGuard)
export class AdminLocalizationController {
  constructor(private readonly localization: LocalizationService) {}

  @Get('settings')
  getSettings(@Req() req: TenantRequest) {
    return this.localization.getSettings(req.tenantId!);
  }

  @Patch('settings')
  updateSettings(
    @Req() req: TenantRequest,
    @Body() body: LocalizationSettingsUpdate,
  ) {
    return this.localization.updateSettings(req.tenantId!, body ?? {});
  }
}
