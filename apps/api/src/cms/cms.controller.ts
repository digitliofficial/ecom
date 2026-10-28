import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { TenantGuard, type TenantRequest } from '../tenancy/tenant.guard';
import { CmsService } from './cms.service';

@Controller('cms')
@UseGuards(TenantGuard)
export class CmsController {
  constructor(private readonly cms: CmsService) {}

  /** Storefront shell: theme + SEO + menus + policy index. */
  @Get('bootstrap')
  bootstrap(
    @Req() req: TenantRequest,
    @Query('locale') locale?: string,
  ) {
    return this.cms.getBootstrap(req.tenantId!, locale?.trim() || 'en');
  }

  @Get('theme')
  theme(@Req() req: TenantRequest) {
    return this.cms.getTheme(req.tenantId!);
  }

  @Get('seo')
  seo(@Req() req: TenantRequest, @Query('locale') locale?: string) {
    return this.cms.getSeo(req.tenantId!, locale?.trim() || 'en');
  }

  @Get('menus/:handle')
  menu(
    @Req() req: TenantRequest,
    @Param('handle') handle: string,
    @Query('locale') locale?: string,
  ) {
    return this.cms.getMenu(req.tenantId!, handle, locale?.trim() || 'en');
  }

  @Get('policies')
  listPolicies(
    @Req() req: TenantRequest,
    @Query('locale') locale?: string,
  ) {
    return this.cms.listPolicies(req.tenantId!, locale?.trim() || 'en');
  }

  @Get('policies/:kind')
  policy(
    @Req() req: TenantRequest,
    @Param('kind') kind: string,
    @Query('locale') locale?: string,
  ) {
    return this.cms.getPolicy(req.tenantId!, kind, locale?.trim() || 'en');
  }
}
