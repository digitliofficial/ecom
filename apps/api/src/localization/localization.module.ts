import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminLocalizationController } from './admin-localization.controller';
import { LocalizationController } from './localization.controller';
import { LocalizationService } from './localization.service';

@Module({
  imports: [AuthModule],
  controllers: [LocalizationController, AdminLocalizationController],
  providers: [LocalizationService],
  exports: [LocalizationService],
})
export class LocalizationModule {}
