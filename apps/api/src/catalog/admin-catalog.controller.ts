import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { StaffAuthGuard } from '../auth/staff-auth.guard';
import { TenantGuard, type TenantRequest } from '../tenancy/tenant.guard';
import {
  CatalogService,
  type ProductCreateInput,
  type ProductUpdateInput,
} from './catalog.service';

@Controller('admin/catalog')
@UseGuards(TenantGuard, StaffAuthGuard)
export class AdminCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('products')
  list(@Req() req: TenantRequest) {
    return this.catalog.listAdminProducts(req.tenantId!);
  }

  @Get('products/:id')
  get(@Req() req: TenantRequest, @Param('id') id: string) {
    return this.catalog.getAdminProduct(req.tenantId!, id);
  }

  @Post('products')
  create(@Req() req: TenantRequest, @Body() body: ProductCreateInput) {
    return this.catalog.createProduct(req.tenantId!, body);
  }

  @Patch('products/:id')
  update(
    @Req() req: TenantRequest,
    @Param('id') id: string,
    @Body() body: ProductUpdateInput,
  ) {
    return this.catalog.updateProduct(req.tenantId!, id, body);
  }
}
