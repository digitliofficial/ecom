import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { ComputeClientService } from '../common/compute.client';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

@Module({
  imports: [CartModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, ComputeClientService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
