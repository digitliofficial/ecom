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
  OrdersService,
  type CreateFulfillmentInput,
  type OrderStatusUpdate,
  type UpdateFulfillmentInput,
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

  @Post(':id/fulfillments')
  createFulfillment(
    @Req() req: TenantRequest,
    @Param('id') id: string,
    @Body() body: CreateFulfillmentInput,
  ) {
    return this.orders.createAdminFulfillment(req.tenantId!, id, body ?? {});
  }

  @Patch(':id/fulfillments/:fulfillmentId')
  updateFulfillment(
    @Req() req: TenantRequest,
    @Param('id') id: string,
    @Param('fulfillmentId') fulfillmentId: string,
    @Body() body: UpdateFulfillmentInput,
  ) {
    return this.orders.updateAdminFulfillment(
      req.tenantId!,
      id,
      fulfillmentId,
      body ?? {},
    );
  }

  @Patch(':id/status')
  updateStatus(
    @Req() req: TenantRequest,
    @Param('id') id: string,
    @Body()
    body: {
      status?: OrderStatusUpdate;
      trackingNumber?: string | null;
      trackingCarrier?: string | null;
    },
  ) {
    return this.orders.updateAdminOrderStatus(req.tenantId!, id, {
      status: body?.status as OrderStatusUpdate,
      trackingNumber: body?.trackingNumber,
      trackingCarrier: body?.trackingCarrier,
    });
  }
}
