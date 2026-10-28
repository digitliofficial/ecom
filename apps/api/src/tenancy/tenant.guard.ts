import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { TenancyService } from './tenancy.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly tenancy: TenancyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      tenantId?: string;
    }>();
    const host =
      req.headers['x-forwarded-host'] ??
      req.headers['x-tenant-host'] ??
      req.headers.host;
    const tenantId = this.tenancy.resolveTenantIdFromHost(host);
    if (!tenantId) {
      throw new UnauthorizedException('Unknown tenant host');
    }
    req.tenantId = tenantId;
    await this.tenancy.setRlsTenantId(tenantId);
    return true;
  }
}
