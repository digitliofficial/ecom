import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { TenantGuard, type TenantRequest } from '../tenancy/tenant.guard';
import { ShippingService } from './shipping.service';

@Controller('shipping')
@UseGuards(TenantGuard)
export class ShippingController {
  constructor(private readonly shipping: ShippingService) {}

  @Get('methods')
  list(
    @Req() req: TenantRequest,
    @Query('paymentMethod') paymentMethod?: string,
  ) {
    return this.shipping.listStorefrontMethods(req.tenantId!, {
      paymentMethod: paymentMethod?.trim() || undefined,
    });
  }
}
