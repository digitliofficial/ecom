import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { TenancyModule } from './tenancy/tenancy.module';
import { AuthModule } from './auth/auth.module';
import { CartModule } from './cart/cart.module';
import { CheckoutModule } from './checkout/checkout.module';

@Module({
  imports: [HealthModule, TenancyModule, AuthModule, CartModule, CheckoutModule],
})
export class AppModule {}
