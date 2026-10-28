import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { B2bModule } from '../b2b/b2b.module';
import { AdminCatalogController } from './admin-catalog.controller';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  imports: [AuthModule, BillingModule, B2bModule],
  controllers: [CatalogController, AdminCatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
