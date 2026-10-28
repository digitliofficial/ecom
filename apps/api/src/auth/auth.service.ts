import { Injectable, UnauthorizedException } from '@nestjs/common';

/** JWT validation stub — Phase 0 */
@Injectable()
export class AuthService {
  validateBearer(authorization?: string): { sub: string; role: string } {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = authorization.slice('Bearer '.length);
    if (!token || token === 'invalid') {
      throw new UnauthorizedException('Invalid token');
    }
    // Stub claims; real JWT verify later
    return { sub: 'stub-user', role: 'staff' };
  }
}
