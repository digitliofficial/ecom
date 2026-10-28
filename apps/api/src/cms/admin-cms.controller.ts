import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { StaffAuthGuard } from '../auth/staff-auth.guard';
import { TenantGuard, type TenantRequest } from '../tenancy/tenant.guard';
import {
  CmsService,
  type MenuUpdateInput,
  type PolicyUpdateInput,
  type SeoSettingsUpdate,
  type ThemeSettingsUpdate,
} from './cms.service';

@Controller('admin/cms')
@UseGuards(TenantGuard, StaffAuthGuard)
export class AdminCmsController {
  constructor(private readonly cms: CmsService) {}

  @Get('theme-packs')
  listThemePacks() {
    return this.cms.listThemePacks();
  }

  @Get('theme')
  getTheme(@Req() req: TenantRequest) {
    return this.cms.getTheme(req.tenantId!);
  }

  @Patch('theme')
  updateTheme(@Req() req: TenantRequest, @Body() body: ThemeSettingsUpdate) {
    return this.cms.updateTheme(req.tenantId!, body ?? {});
  }

  @Get('seo')
  getSeo(@Req() req: TenantRequest, @Query('locale') locale?: string) {
    return this.cms.getSeo(req.tenantId!, locale?.trim() || 'en');
  }

  @Patch('seo')
  updateSeo(@Req() req: TenantRequest, @Body() body: SeoSettingsUpdate) {
    return this.cms.updateSeo(req.tenantId!, body ?? {});
  }

  @Get('menus/:handle')
  getMenu(
    @Req() req: TenantRequest,
    @Param('handle') handle: string,
    @Query('locale') locale?: string,
  ) {
    return this.cms.getMenu(req.tenantId!, handle, locale?.trim() || 'en');
  }

  @Put('menus/:handle')
  replaceMenu(
    @Req() req: TenantRequest,
    @Param('handle') handle: string,
    @Body() body: MenuUpdateInput,
  ) {
    return this.cms.replaceMenu(req.tenantId!, handle, body ?? { items: [] });
  }

  @Get('policies')
  listPolicies(
    @Req() req: TenantRequest,
    @Query('locale') locale?: string,
  ) {
    return this.cms.listPolicies(req.tenantId!, locale?.trim() || 'en');
  }

  @Get('policies/:kind')
  getPolicy(
    @Req() req: TenantRequest,
    @Param('kind') kind: string,
    @Query('locale') locale?: string,
  ) {
    return this.cms.getPolicy(req.tenantId!, kind, locale?.trim() || 'en');
  }

  @Patch('policies/:kind')
  updatePolicy(
    @Req() req: TenantRequest,
    @Param('kind') kind: string,
    @Body() body: PolicyUpdateInput,
  ) {
    return this.cms.updatePolicy(req.tenantId!, kind, body ?? {});
  }
}
