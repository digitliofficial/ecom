import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { TenantGuard, type TenantRequest } from '../tenancy/tenant.guard';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(TenantGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Storefront: enabled offline methods (+ bank details when transfer is on). */
  @Get('methods')
  listMethods(@Req() req: TenantRequest) {
    return this.payments.listStorefrontMethods(req.tenantId!);
  }
}
