import {
  Body,
  Controller,
  Delete,
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
import { TenantGuard } from '../tenancy/tenant.guard';
import { WishlistService } from './wishlist.service';

@Controller('wishlist')
@UseGuards(TenantGuard, CustomerAuthGuard)
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  get(@Req() req: CustomerRequest) {
    return this.wishlist.getOrCreate(req.tenantId!, req.customer!.sub);
  }

  @Post('items')
  add(
    @Req() req: CustomerRequest,
    @Body() body: { variantId?: string },
  ) {
    return this.wishlist.addItem(
      req.tenantId!,
      req.customer!.sub,
      body.variantId ?? '',
    );
  }

  @Delete('items/:variantId')
  remove(@Req() req: CustomerRequest, @Param('variantId') variantId: string) {
    return this.wishlist.removeItem(
      req.tenantId!,
      req.customer!.sub,
      variantId,
    );
  }
}
