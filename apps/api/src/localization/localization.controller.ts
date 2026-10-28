import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { TenantGuard, type TenantRequest } from '../tenancy/tenant.guard';
import { LocalizationService } from './localization.service';

@Controller('localization')
@UseGuards(TenantGuard)
export class LocalizationController {
  constructor(private readonly localization: LocalizationService) {}

  /** Storefront: defaults + effective enabled locales/currencies for switchers. */
  @Get()
  getConfig(@Req() req: TenantRequest) {
    return this.localization.getStorefrontConfig(req.tenantId!);
  }
}
