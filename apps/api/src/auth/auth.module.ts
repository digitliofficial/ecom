import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { CustomerAuthGuard } from './customer-auth.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, StaffAuthGuard, CustomerAuthGuard],
  exports: [AuthService, StaffAuthGuard, CustomerAuthGuard],
})
export class AuthModule {}
