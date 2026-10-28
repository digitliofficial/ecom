import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { StaffAuthGuard } from '../auth/staff-auth.guard';
import { TenantGuard, type TenantRequest } from '../tenancy/tenant.guard';
import {
  OrdersService,
  type OrderStatusUpdate,
} from './orders.service';

@Controller('admin/orders')
@UseGuards(TenantGuard, StaffAuthGuard)
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@Req() req: TenantRequest) {
    return this.orders.listAdminOrders(req.tenantId!);
  }

  @Get(':id')
  get(@Req() req: TenantRequest, @Param('id') id: string) {
    return this.orders.getAdminOrder(req.tenantId!, id);
  }

  @Patch(':id/status')
  updateStatus(
    @Req() req: TenantRequest,
    @Param('id') id: string,
    @Body() body: { status?: OrderStatusUpdate },
  ) {
    return this.orders.updateAdminOrderStatus(
      req.tenantId!,
      id,
      body?.status as OrderStatusUpdate,
    );
  }
}
