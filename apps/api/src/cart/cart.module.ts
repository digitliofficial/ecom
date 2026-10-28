import { Module } from '@nestjs/common';
import { LocalizationModule } from '../localization/localization.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  imports: [LocalizationModule, NotificationsModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
