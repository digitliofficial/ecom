import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { StaffAuthGuard } from '../auth/staff-auth.guard';
import { TenantGuard, type TenantRequest } from '../tenancy/tenant.guard';
import { B2bService } from './b2b.service';

@Controller('admin/b2b')
@UseGuards(TenantGuard, StaffAuthGuard)
export class AdminB2bController {
  constructor(private readonly b2b: B2bService) {}

  @Get('price-lists')
  listPriceLists(@Req() req: TenantRequest) {
    return this.b2b.listPriceLists(req.tenantId!);
  }

  @Post('price-lists')
  createPriceList(
    @Req() req: TenantRequest,
    @Body()
    body: {
      name?: string;
      currency?: string;
      items?: {
        variantId: string;
        unitAmountMinor: number;
        currency?: string;
      }[];
    },
  ) {
    return this.b2b.createPriceList(req.tenantId!, {
      name: body.name ?? '',
      currency: body.currency,
      items: body.items,
    });
  }

  @Patch('price-lists/:id')
  updatePriceList(
    @Req() req: TenantRequest,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      currency?: string;
      items?: {
        variantId: string;
        unitAmountMinor: number;
        currency?: string;
      }[];
    },
  ) {
    return this.b2b.updatePriceList(req.tenantId!, id, body);
  }

  @Get('customer-groups')
  listGroups(@Req() req: TenantRequest) {
    return this.b2b.listCustomerGroups(req.tenantId!);
  }

  @Post('customer-groups')
  createGroup(
    @Req() req: TenantRequest,
    @Body()
    body: {
      name?: string;
      priceListId?: string | null;
      customerIds?: string[];
    },
  ) {
    return this.b2b.createCustomerGroup(req.tenantId!, {
      name: body.name ?? '',
      priceListId: body.priceListId,
      customerIds: body.customerIds,
    });
  }

  @Patch('customer-groups/:id')
  updateGroup(
    @Req() req: TenantRequest,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      priceListId?: string | null;
      customerIds?: string[];
    },
  ) {
    return this.b2b.updateCustomerGroup(req.tenantId!, id, body);
  }

  @Post('customer-groups/:id/members')
  addMember(
    @Req() req: TenantRequest,
    @Param('id') id: string,
    @Body() body: { customerId?: string },
  ) {
    return this.b2b.addGroupMember(req.tenantId!, id, body.customerId ?? '');
  }

  @Delete('customer-groups/:id/members/:customerId')
  removeMember(
    @Req() req: TenantRequest,
    @Param('id') id: string,
    @Param('customerId') customerId: string,
  ) {
    return this.b2b.removeGroupMember(req.tenantId!, id, customerId);
  }
}
