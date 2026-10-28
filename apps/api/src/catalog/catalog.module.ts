import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CollectionsModule } from '../collections/collections.module';
import { AdminCatalogController } from './admin-catalog.controller';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  imports: [AuthModule, CollectionsModule],
  controllers: [CatalogController, AdminCatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}

