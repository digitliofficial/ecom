import { Controller, Get, Headers } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('me')
  me(@Headers('authorization') authorization?: string) {
    return this.auth.validateBearer(authorization);
  }
}
