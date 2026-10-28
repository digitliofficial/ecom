import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { ComputeClientService } from '../common/compute.client';
import { PaymentsModule } from '../payments/payments.module';
import { ShippingModule } from '../shipping/shipping.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

@Module({
  imports: [CartModule, AuthModule, PaymentsModule, ShippingModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, ComputeClientService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
