import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import type { JwtClaims } from './auth.types';

export type CustomerRequest = {
  headers: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string>;
  tenantId?: string;
  customer?: JwtClaims;
};

/** Requires customer JWT via Authorization Bearer or ecom_customer_session cookie. */
@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<CustomerRequest>();
    const claims = this.auth.optionalCustomerClaims(req);
    if (!claims) {
      throw new UnauthorizedException('Customer session required');
    }
    req.customer = claims;
    return true;
  }
}
