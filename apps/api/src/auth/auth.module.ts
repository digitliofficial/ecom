import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { StaffAuthGuard } from './staff-auth.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, StaffAuthGuard],
  exports: [AuthService, StaffAuthGuard],
})
export class AuthModule {}
