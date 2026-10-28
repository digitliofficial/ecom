import { Module } from '@nestjs/common';
import { DatabaseModule } from '../db/database.module';
import { MigrationService } from './migration.service';
import { PlatformApiKeyGuard } from './platform-api-key.guard';
import { PlatformMigrationController } from './platform-migration.controller';
import { ShopifyAdminClient } from './shopify-admin.client';

@Module({
  imports: [DatabaseModule],
  controllers: [PlatformMigrationController],
  providers: [MigrationService, ShopifyAdminClient, PlatformApiKeyGuard],
  exports: [MigrationService],
})
export class MigrationModule {}
