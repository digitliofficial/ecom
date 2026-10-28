import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { TenantGuard } from '../tenancy/tenant.guard';
import { NoopAdapter } from '@ecom/payment-providers';

@Controller('checkout')
@UseGuards(TenantGuard)
export class CheckoutController {
  private readonly payments = new NoopAdapter();

  @Post('sessions')
  async createSession(
    @Body()
    body: {
      cartId?: string;
      email?: string;
      shippingAddress?: Record<string, unknown>;
    },
  ) {
    const payment = await this.payments.createPayment({
      tenantId: 'demo',
      amountMinor: 0,
      currency: 'USD',
    });
    return {
      id: 'checkout_stub',
      cartId: body.cartId ?? null,
      guestEmail: body.email ?? null,
      shippingAddress: body.shippingAddress ?? null,
      addressValidation: { mode: 'soft_warn', status: 'not_run' },
      payment,
      message: 'Phase 0 stub — stop before PaymentIntent',
    };
  }
}
