import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminPrivacyController } from './admin-privacy.controller';
import {
  CustomerDsarController,
  PrivacyController,
} from './privacy.controller';
import { PrivacyService } from './privacy.service';

@Module({
  imports: [AuthModule],
  controllers: [
    PrivacyController,
    CustomerDsarController,
    AdminPrivacyController,
  ],
  providers: [PrivacyService],
  exports: [PrivacyService],
})
export class PrivacyModule {}
