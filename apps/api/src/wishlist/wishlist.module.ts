import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { B2bModule } from '../b2b/b2b.module';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';

@Module({
  imports: [AuthModule, B2bModule],
  controllers: [WishlistController],
  providers: [WishlistService],
  exports: [WishlistService],
})
export class WishlistModule {}
