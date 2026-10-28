import { Module } from '@nestjs/common';
import { DatabaseModule } from './db/database.module';
import { HealthModule } from './health/health.module';
import { TenancyModule } from './tenancy/tenancy.module';
import { AuthModule } from './auth/auth.module';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { CartModule } from './cart/cart.module';
import { CheckoutModule } from './checkout/checkout.module';
import { CatalogModule } from './catalog/catalog.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { ShippingModule } from './shipping/shipping.module';
import { DomainsModule } from './domains/domains.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { LocalizationModule } from './localization/localization.module';
import { PrivacyModule } from './privacy/privacy.module';
import { CmsModule } from './cms/cms.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MigrationModule } from './migration/migration.module';
import { BillingModule } from './billing/billing.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { ReviewsModule } from './reviews/reviews.module';
import { B2bModule } from './b2b/b2b.module';

@Module({
  imports: [
    DatabaseModule,
    HealthModule,
    TenancyModule,
    AuthModule,
    EntitlementsModule,
    B2bModule,
    CatalogModule,
    CartModule,
    CheckoutModule,
    OrdersModule,
    PaymentsModule,
    ShippingModule,
    DomainsModule,
    AnalyticsModule,
    LocalizationModule,
    PrivacyModule,
    CmsModule,
    NotificationsModule,
    MigrationModule,
    BillingModule,
    WishlistModule,
    ReviewsModule,
  ],
})
export class AppModule {}
