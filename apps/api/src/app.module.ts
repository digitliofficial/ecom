import { Module } from '@nestjs/common';
import { DatabaseModule } from './db/database.module';
import { HealthModule } from './health/health.module';
import { TenancyModule } from './tenancy/tenancy.module';
import { AuthModule } from './auth/auth.module';
import { CartModule } from './cart/cart.module';
import { CheckoutModule } from './checkout/checkout.module';
import { CatalogModule } from './catalog/catalog.module';

@Module({
  imports: [
    DatabaseModule,
    HealthModule,
    TenancyModule,
    AuthModule,
    CatalogModule,
    CartModule,
    CheckoutModule,
  ],
})
export class AppModule {}
