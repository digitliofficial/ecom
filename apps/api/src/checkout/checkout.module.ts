import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { ComputeClientService } from '../common/compute.client';
import { PaymentsModule } from '../payments/payments.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

@Module({
  imports: [CartModule, AuthModule, PaymentsModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, ComputeClientService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
