import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { TenantGuard, type TenantRequest } from '../tenancy/tenant.guard';
import { CollectionsService } from './collections.service';

@Controller('catalog')
@UseGuards(TenantGuard)
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get('collections')
  list(@Req() req: TenantRequest) {
    return this.collections.listStorefront(req.tenantId!);
  }

  @Get('collections/:slug')
  getBySlug(@Req() req: TenantRequest, @Param('slug') slug: string) {
    return this.collections.getStorefrontBySlug(req.tenantId!, slug);
  }
}
