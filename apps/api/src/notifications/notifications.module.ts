import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AbandonedCartService } from './abandoned-cart.service';
import { AdminNotificationsController } from './admin-notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsWorker } from './notifications.worker';

@Module({
  imports: [AuthModule],
  controllers: [AdminNotificationsController],
  providers: [
    NotificationsService,
    AbandonedCartService,
    NotificationsWorker,
  ],
  exports: [NotificationsService, AbandonedCartService],
})
export class NotificationsModule {}
