import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { TenantGuard, type TenantRequest } from '../tenancy/tenant.guard';
import { CollectionsService } from '../collections/collections.service';
import { CatalogService } from './catalog.service';

@Controller('catalog')
@UseGuards(TenantGuard)
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly collections: CollectionsService,
  ) {}

  @Get('products')
  list(
    @Req() req: TenantRequest,
    @Query('collection') collectionSlug?: string,
  ) {
    if (collectionSlug?.trim()) {
      return this.collections.listProductsByCollectionSlug(
        req.tenantId!,
        collectionSlug,
      );
    }
    return this.catalog.listProducts(req.tenantId!);
  }
}
