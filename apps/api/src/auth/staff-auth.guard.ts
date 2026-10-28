import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import type { JwtClaims } from './auth.types';

export type StaffRequest = {
  headers: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string>;
  tenantId?: string;
  staff?: JwtClaims;
};

/** Requires staff JWT via Authorization Bearer or ecom_staff_session cookie. */
@Injectable()
export class StaffAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<StaffRequest>();
    try {
      req.staff = this.auth.requireStaffClaims(req);
      return true;
    } catch {
      throw new UnauthorizedException('Staff session required');
    }
  }
}
