import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { ComputeClientService } from '../common/compute.client';
import { DiscountsModule } from '../discounts/discounts.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PaymentsModule } from '../payments/payments.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

@Module({
  imports: [
    CartModule,
    AuthModule,
    PaymentsModule,
    DiscountsModule,
    InventoryModule,
  ],
  controllers: [CheckoutController],
  providers: [CheckoutService, ComputeClientService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
