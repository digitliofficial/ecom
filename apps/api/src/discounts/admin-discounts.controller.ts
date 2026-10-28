import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { StaffAuthGuard } from '../auth/staff-auth.guard';
import { TenantGuard, type TenantRequest } from '../tenancy/tenant.guard';
import {
  DiscountsService,
  type DiscountCreateInput,
  type DiscountUpdateInput,
} from './discounts.service';

@Controller('admin/discounts')
@UseGuards(TenantGuard, StaffAuthGuard)
export class AdminDiscountsController {
  constructor(private readonly discounts: DiscountsService) {}

  @Get()
  list(@Req() req: TenantRequest) {
    return this.discounts.listAdmin(req.tenantId!);
  }

  @Get(':id')
  get(@Req() req: TenantRequest, @Param('id') id: string) {
    return this.discounts.getAdmin(req.tenantId!, id);
  }

  @Post()
  create(@Req() req: TenantRequest, @Body() body: DiscountCreateInput) {
    return this.discounts.create(req.tenantId!, body);
  }

  @Patch(':id')
  update(
    @Req() req: TenantRequest,
    @Param('id') id: string,
    @Body() body: DiscountUpdateInput,
  ) {
    return this.discounts.update(req.tenantId!, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Req() req: TenantRequest, @Param('id') id: string) {
    await this.discounts.remove(req.tenantId!, id);
  }
}
