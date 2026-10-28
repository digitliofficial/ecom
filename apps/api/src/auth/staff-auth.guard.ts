import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

export type StaffRequest = {
  headers: Record<string, string | string[] | undefined>;
  staff?: { sub: string; role: string };
};

/** Requires Authorization: Bearer <any non-empty stub token>. */
@Injectable()
export class StaffAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<StaffRequest>();
    const raw = req.headers.authorization;
    const authorization = Array.isArray(raw) ? raw[0] : raw;
    try {
      req.staff = this.auth.validateBearer(authorization);
      return true;
    } catch {
      throw new UnauthorizedException('Staff bearer token required');
    }
  }
}
