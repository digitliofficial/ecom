import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { TenantGuard, type TenantRequest } from '../tenancy/tenant.guard';
import { readGuestToken } from '../common/guest-token';
import { AuthService } from './auth.service';

@Controller('auth')
@UseGuards(TenantGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('me')
  me(@Req() req: TenantRequest) {
    return this.auth.meFromRequest(req);
  }

  @Post('staff/login')
  async staffLogin(
    @Req() req: TenantRequest,
    @Res({ passthrough: true }) res: Response,
    @Body() body: { email?: string; password?: string },
  ) {
    const result = await this.auth.loginStaff(
      req.tenantId!,
      body.email ?? '',
      body.password ?? '',
    );
    this.auth.setSessionCookie(res, 'staff', result.token);
    return { user: result.user, token: result.token };
  }

  @Post('staff/logout')
  staffLogout(@Res({ passthrough: true }) res: Response) {
    this.auth.clearSessionCookie(res, 'staff');
    return { ok: true };
  }

  @Post('customer/register')
  async customerRegister(
    @Req() req: TenantRequest,
    @Res({ passthrough: true }) res: Response,
    @Body()
    body: { email?: string; password?: string; displayName?: string },
  ) {
    const result = await this.auth.registerCustomer(req.tenantId!, {
      email: body.email ?? '',
      password: body.password ?? '',
      displayName: body.displayName,
    });
    await this.auth.linkGuestCart(
      req.tenantId!,
      result.user.id,
      readGuestToken(req),
    );
    this.auth.setSessionCookie(res, 'customer', result.token);
    return { user: result.user, token: result.token };
  }

  @Post('customer/login')
  async customerLogin(
    @Req() req: TenantRequest,
    @Res({ passthrough: true }) res: Response,
    @Body() body: { email?: string; password?: string },
  ) {
    const result = await this.auth.loginCustomer(
      req.tenantId!,
      body.email ?? '',
      body.password ?? '',
    );
    await this.auth.linkGuestCart(
      req.tenantId!,
      result.user.id,
      readGuestToken(req),
    );
    this.auth.setSessionCookie(res, 'customer', result.token);
    return { user: result.user, token: result.token };
  }

  @Post('customer/logout')
  customerLogout(@Res({ passthrough: true }) res: Response) {
    this.auth.clearSessionCookie(res, 'customer');
    return { ok: true };
  }
}
