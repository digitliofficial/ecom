import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { TenantGuard } from '../tenancy/tenant.guard';

@Controller('carts')
@UseGuards(TenantGuard)
export class CartController {
  @Post()
  create() {
    return {
      id: 'cart_stub',
      status: 'active',
      lines: [],
      message: 'Phase 0 stub — persist in vertical slice',
    };
  }

  @Get(':id')
  get() {
    return { id: 'cart_stub', status: 'active', lines: [] };
  }

  @Post(':id/lines')
  addLine() {
    return { id: 'cart_stub', lines: [{ variantId: 'var_stub', quantity: 1 }] };
  }
}
