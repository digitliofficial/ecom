import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminCollectionsController } from './admin-collections.controller';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';

@Module({
  imports: [AuthModule],
  controllers: [CollectionsController, AdminCollectionsController],
  providers: [CollectionsService],
  exports: [CollectionsService],
})
export class CollectionsModule {}
