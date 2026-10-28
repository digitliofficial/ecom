import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { TenancyService } from './tenancy.service';

export type TenantRequest = {
  headers: Record<string, string | string[] | undefined>;
  tenantId?: string;
  cookies?: Record<string, string>;
};

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly tenancy: TenancyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<TenantRequest>();
    const rawHost =
      req.headers['x-forwarded-host'] ??
      req.headers['x-tenant-host'] ??
      req.headers.host;
    const host = Array.isArray(rawHost) ? rawHost[0] : rawHost;
    const tenantId = await this.tenancy.resolveTenantIdFromHost(host);
    if (!tenantId) {
      throw new UnauthorizedException('Unknown tenant host');
    }
    req.tenantId = tenantId;
    await this.tenancy.setRlsTenantId(tenantId);
    return true;
  }
}
