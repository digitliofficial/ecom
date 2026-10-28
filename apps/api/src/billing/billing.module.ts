import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingController } from './billing.controller';
import { MeteringService } from './metering.service';

@Module({
  imports: [AuthModule],
  controllers: [BillingController],
  providers: [MeteringService],
  exports: [MeteringService],
})
export class BillingModule {}
