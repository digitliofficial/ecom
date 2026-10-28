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
  ShippingService,
  type ShippingMethodCreate,
  type ShippingMethodUpdate,
} from './shipping.service';

@Controller('admin/shipping')
@UseGuards(TenantGuard, StaffAuthGuard)
export class AdminShippingController {
  constructor(private readonly shipping: ShippingService) {}

  @Get('methods')
  list(@Req() req: TenantRequest) {
    return this.shipping.listAdminMethods(req.tenantId!);
  }

  @Post('methods')
  create(@Req() req: TenantRequest, @Body() body: ShippingMethodCreate) {
    return this.shipping.createMethod(req.tenantId!, body ?? ({} as ShippingMethodCreate));
  }

  @Patch('methods/:id')
  update(
    @Req() req: TenantRequest,
    @Param('id') id: string,
    @Body() body: ShippingMethodUpdate,
  ) {
    return this.shipping.updateMethod(req.tenantId!, id, body ?? {});
  }
}
