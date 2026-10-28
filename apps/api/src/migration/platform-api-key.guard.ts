import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Platform-ops gate for migration endpoints (platform-admin + CLI).
 * Header: X-Platform-Key matching PLATFORM_API_KEY.
 * Local default is intentionally weak — set a strong secret before shared use.
 */
@Injectable()
export class PlatformApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const raw = req.headers['x-platform-key'];
    const provided = Array.isArray(raw) ? raw[0] : raw;
    const expected =
      process.env.PLATFORM_API_KEY?.trim() ||
      'ecom-local-platform-key-change-me';

    if (!provided || provided !== expected) {
      throw new UnauthorizedException('Valid X-Platform-Key required');
    }
    return true;
  }
}
