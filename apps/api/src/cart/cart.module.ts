import { Module } from '@nestjs/common';
import { B2bModule } from '../b2b/b2b.module';
import { LocalizationModule } from '../localization/localization.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  imports: [LocalizationModule, NotificationsModule, B2bModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
