import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  CustomerAuthGuard,
  type CustomerRequest,
} from '../auth/customer-auth.guard';
import { TenantGuard, type TenantRequest } from '../tenancy/tenant.guard';
import { ReviewsService } from './reviews.service';

@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('catalog/products/:productId/reviews')
  @UseGuards(TenantGuard)
  listApproved(
    @Req() req: TenantRequest,
    @Param('productId') productId: string,
  ) {
    return this.reviews.listApproved(req.tenantId!, productId);
  }

  @Get('catalog/products/:productId/rating')
  @UseGuards(TenantGuard)
  rating(@Req() req: TenantRequest, @Param('productId') productId: string) {
    return this.reviews.getProductRating(req.tenantId!, productId);
  }

  @Post('catalog/products/:productId/reviews')
  @UseGuards(TenantGuard, CustomerAuthGuard)
  create(
    @Req() req: CustomerRequest,
    @Param('productId') productId: string,
    @Body()
    body: { rating?: number; title?: string; body?: string; locale?: string },
  ) {
    return this.reviews.create(req.tenantId!, req.customer!.sub, productId, {
      rating: body.rating ?? 0,
      title: body.title,
      body: body.body ?? '',
      locale: body.locale,
    });
  }
}
