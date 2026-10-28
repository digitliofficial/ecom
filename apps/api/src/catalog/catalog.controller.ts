import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { TenantGuard, type TenantRequest } from '../tenancy/tenant.guard';
import { CatalogService } from './catalog.service';

@Controller('catalog')
@UseGuards(TenantGuard)
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly auth: AuthService,
  ) {}

  @Get('products')
  list(@Req() req: TenantRequest) {
    const customer = this.auth.optionalCustomerClaims(req);
    return this.catalog.listProducts(req.tenantId!, customer?.sub);
  }
}
