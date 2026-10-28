import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ComputeClientService } from '../common/compute.client';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminOrdersController } from './admin-orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [AdminOrdersController],
  providers: [OrdersService, ComputeClientService],
  exports: [OrdersService],
})
export class OrdersModule {}
