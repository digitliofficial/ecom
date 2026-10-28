import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminShippingController } from './admin-shipping.controller';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';

@Module({
  imports: [AuthModule],
  controllers: [ShippingController, AdminShippingController],
  providers: [ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}
