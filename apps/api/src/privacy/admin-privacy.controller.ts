import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { StaffAuthGuard } from '../auth/staff-auth.guard';
import { TenantGuard, type TenantRequest } from '../tenancy/tenant.guard';
import {
  PrivacyService,
  type PrivacySettingsUpdate,
} from './privacy.service';

@Controller('admin/privacy')
@UseGuards(TenantGuard, StaffAuthGuard)
export class AdminPrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Get('settings')
  getSettings(@Req() req: TenantRequest) {
    return this.privacy.getSettings(req.tenantId!);
  }

  @Patch('settings')
  updateSettings(
    @Req() req: TenantRequest,
    @Body() body: PrivacySettingsUpdate,
  ) {
    return this.privacy.updateSettings(req.tenantId!, body ?? {});
  }

  @Get('dsar')
  listDsar(@Req() req: TenantRequest) {
    return this.privacy.listAdminDsar(req.tenantId!);
  }

  @Get('dsar/:id')
  getDsar(@Req() req: TenantRequest, @Param('id') id: string) {
    return this.privacy.getAdminDsar(req.tenantId!, id);
  }
}
