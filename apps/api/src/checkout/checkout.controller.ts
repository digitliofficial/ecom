import {
  Body,
  Controller,
  NotFoundException,
  Post,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { TenantGuard, type TenantRequest } from '../tenancy/tenant.guard';
import { CartService } from '../cart/cart.service';
import { CheckoutService, type ShippingAddressInput } from './checkout.service';
import { readGuestToken } from '../common/guest-token';

@Controller('checkout')
@UseGuards(TenantGuard)
export class CheckoutController {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly carts: CartService,
  ) {}

  @Post('sessions')
  async createSession(
    @Req() req: TenantRequest,
    @Body()
    body: {
      cartId?: string;
      email?: string;
      shippingAddress?: ShippingAddressInput;
    },
  ) {
    let cartId = body.cartId;
    if (!cartId) {
      const token = readGuestToken(req);
      if (!token) {
        throw new BadRequestException('cartId or guest cart token required');
      }
      const cart = await this.carts.getByGuestToken(req.tenantId!, token);
      if (!cart) throw new NotFoundException('Cart not found');
      cartId = cart.id;
    } else {
      const cart = await this.carts.getById(req.tenantId!, cartId);
      if (!cart) throw new NotFoundException('Cart not found');
      const token = readGuestToken(req);
      if (!token || token !== cart.guestToken) {
        throw new NotFoundException('Cart not found');
      }
    }

    if (!body.email) throw new BadRequestException('email is required');
    if (!body.shippingAddress) {
      throw new BadRequestException('shippingAddress is required');
    }

    return this.checkout.createSession(req.tenantId!, {
      cartId,
      email: body.email,
      shippingAddress: body.shippingAddress,
    });
  }
}
