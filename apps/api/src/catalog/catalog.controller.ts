import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { TenantGuard, type TenantRequest } from '../tenancy/tenant.guard';
import { CatalogService } from './catalog.service';

@Controller('catalog')
@UseGuards(TenantGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('products')
  list(@Req() req: TenantRequest) {
    return this.catalog.listProducts(req.tenantId!);
  }
}
