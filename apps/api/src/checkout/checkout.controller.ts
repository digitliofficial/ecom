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
import { AuthService } from '../auth/auth.service';

@Controller('checkout')
@UseGuards(TenantGuard)
export class CheckoutController {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly carts: CartService,
    private readonly auth: AuthService,
  ) {}

  @Post('sessions')
  async createSession(
    @Req() req: TenantRequest,
    @Body()
    body: {
      cartId?: string;
      email?: string;
      shippingAddress?: ShippingAddressInput;
      paymentMethod?: string;
      shippingMethodId?: string;
    },
  ) {
    const customer = this.auth.optionalCustomerClaims(req);

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
      const ownsAsGuest = Boolean(token && token === cart.guestToken);
      const ownsAsCustomer = Boolean(
        customer && cart.customerId && cart.customerId === customer.sub,
      );
      if (!ownsAsGuest && !ownsAsCustomer) {
        throw new NotFoundException('Cart not found');
      }
    }

    const email = body.email?.trim() || customer?.email;
    if (!email) throw new BadRequestException('email is required');
    if (!body.shippingAddress) {
      throw new BadRequestException('shippingAddress is required');
    }
    if (!body.paymentMethod) {
      throw new BadRequestException('paymentMethod is required');
    }
    if (!body.shippingMethodId) {
      throw new BadRequestException('shippingMethodId is required');
    }

    return this.checkout.createSession(req.tenantId!, {
      cartId,
      email,
      shippingAddress: body.shippingAddress,
      paymentMethod: body.paymentMethod,
      shippingMethodId: body.shippingMethodId,
      customerId: customer?.sub ?? null,
    });
  }
}
