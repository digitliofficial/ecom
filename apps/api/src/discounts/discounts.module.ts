import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminDiscountsController } from './admin-discounts.controller';
import { DiscountsService } from './discounts.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminDiscountsController],
  providers: [DiscountsService],
  exports: [DiscountsService],
})
export class DiscountsModule {}
