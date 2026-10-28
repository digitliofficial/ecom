import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminB2bController } from './admin-b2b.controller';
import { B2bPricingService } from './b2b-pricing.service';
import { B2bService } from './b2b.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminB2bController],
  providers: [B2bService, B2bPricingService],
  exports: [B2bService, B2bPricingService],
})
export class B2bModule {}
