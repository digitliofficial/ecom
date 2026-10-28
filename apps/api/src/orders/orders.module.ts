import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ComputeClientService } from '../common/compute.client';
import { AdminOrdersController } from './admin-orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminOrdersController],
  providers: [OrdersService, ComputeClientService],
  exports: [OrdersService],
})
export class OrdersModule {}
