import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Response } from 'express';
import { DatabaseService } from '../db/database.service';
import {
  CUSTOMER_SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
  STAFF_SESSION_COOKIE,
  type AuthKind,
  type AuthUserView,
  type JwtClaims,
  type StaffRole,
} from './auth.types';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService) {}

  private jwtSecret(): string {
    const secret = process.env.JWT_SECRET?.trim();
    if (secret) return secret;
    // Local/dev fallback so demos work without copying .env; do not use in production.
    return 'ecom-local-dev-jwt-secret-change-me';
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  signToken(claims: JwtClaims): string {
    return jwt.sign(claims, this.jwtSecret(), {
      expiresIn: SESSION_MAX_AGE_SEC,
    });
  }

  verifyToken(token: string): JwtClaims {
    try {
      const payload = jwt.verify(token, this.jwtSecret()) as jwt.JwtPayload;
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.email !== 'string' ||
        typeof payload.tenantId !== 'string' ||
        (payload.kind !== 'staff' && payload.kind !== 'customer') ||
        typeof payload.role !== 'string'
      ) {
        throw new UnauthorizedException('Invalid token claims');
      }
      return {
        sub: payload.sub,
        email: payload.email,
        tenantId: payload.tenantId,
        kind: payload.kind,
        role: payload.role as JwtClaims['role'],
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  extractBearer(authorization?: string): string | null {
    if (!authorization?.startsWith('Bearer ')) return null;
    const token = authorization.slice('Bearer '.length).trim();
    return token.length > 0 ? token : null;
  }

  extractCookie(
    req: { headers: Record<string, string | string[] | undefined>; cookies?: Record<string, string> },
    name: string,
  ): string | null {
    if (req.cookies?.[name]) return req.cookies[name] ?? null;
    const raw = req.headers.cookie;
    if (typeof raw !== 'string') return null;
    const match = raw
      .split(';')
      .map((p) => p.trim())
      .find((p) => p.startsWith(`${name}=`));
    if (!match) return null;
    return decodeURIComponent(match.slice(name.length + 1));
  }

  sessionCookie(name: string, token: string): string {
    return `${name}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SEC}`;
  }

  clearCookie(name: string): string {
    return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  }

  setSessionCookie(res: Response, kind: AuthKind, token: string) {
    const name =
      kind === 'staff' ? STAFF_SESSION_COOKIE : CUSTOMER_SESSION_COOKIE;
    res.append('Set-Cookie', this.sessionCookie(name, token));
  }

  clearSessionCookie(res: Response, kind: AuthKind) {
    const name =
      kind === 'staff' ? STAFF_SESSION_COOKIE : CUSTOMER_SESSION_COOKIE;
    res.append('Set-Cookie', this.clearCookie(name));
  }

  resolveStaffToken(req: {
    headers: Record<string, string | string[] | undefined>;
    cookies?: Record<string, string>;
  }): string | null {
    const rawAuth = req.headers.authorization;
    const authorization = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
    return (
      this.extractBearer(authorization) ??
      this.extractCookie(req, STAFF_SESSION_COOKIE)
    );
  }

  resolveCustomerToken(req: {
    headers: Record<string, string | string[] | undefined>;
    cookies?: Record<string, string>;
  }): string | null {
    const rawAuth = req.headers.authorization;
    const authorization = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
    return (
      this.extractBearer(authorization) ??
      this.extractCookie(req, CUSTOMER_SESSION_COOKIE)
    );
  }

  claimsToView(claims: JwtClaims, displayName?: string | null): AuthUserView {
    return {
      id: claims.sub,
      email: claims.email,
      displayName: displayName ?? null,
      tenantId: claims.tenantId,
      kind: claims.kind,
      role: claims.role,
    };
  }

  async loginStaff(
    tenantId: string,
    email: string,
    password: string,
  ): Promise<{ token: string; user: AuthUserView }> {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes('@') || !password) {
      throw new BadRequestException('Email and password are required');
    }

    const row = await this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<{
        id: string;
        email: string;
        password_hash: string;
        display_name: string | null;
        role: StaffRole;
      }>(
        `SELECT u.id, u.email, u.password_hash, u.display_name, m.role
         FROM users u
         INNER JOIN memberships m ON m.user_id = u.id
         WHERE lower(u.email) = $1
         LIMIT 1`,
        [normalized],
      );
      return res.rows[0] ?? null;
    });

    if (!row || !(await this.verifyPassword(password, row.password_hash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const claims: JwtClaims = {
      sub: row.id,
      email: row.email,
      tenantId,
      kind: 'staff',
      role: row.role,
    };
    const token = this.signToken(claims);
    return {
      token,
      user: this.claimsToView(claims, row.display_name),
    };
  }

  async registerCustomer(
    tenantId: string,
    input: { email: string; password: string; displayName?: string },
  ): Promise<{ token: string; user: AuthUserView }> {
    const normalized = input.email.trim().toLowerCase();
    const password = input.password;
    if (!normalized.includes('@')) {
      throw new BadRequestException('Valid email is required');
    }
    if (!password || password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const passwordHash = await this.hashPassword(password);
    const displayName = input.displayName?.trim() || null;

    try {
      const row = await this.db.withTenant(tenantId, async (client) => {
        const res = await client.query<{
          id: string;
          email: string;
          display_name: string | null;
        }>(
          `INSERT INTO customers (tenant_id, email, password_hash, display_name, email_verified_at)
           VALUES ($1, $2, $3, $4, now())
           RETURNING id, email, display_name`,
          [tenantId, normalized, passwordHash, displayName],
        );
        return res.rows[0]!;
      });

      const claims: JwtClaims = {
        sub: row.id,
        email: row.email,
        tenantId,
        kind: 'customer',
        role: 'customer',
      };
      return {
        token: this.signToken(claims),
        user: this.claimsToView(claims, row.display_name),
      };
    } catch (err) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === '23505'
      ) {
        throw new ConflictException('An account with this email already exists');
      }
      throw err;
    }
  }

  async loginCustomer(
    tenantId: string,
    email: string,
    password: string,
  ): Promise<{ token: string; user: AuthUserView }> {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes('@') || !password) {
      throw new BadRequestException('Email and password are required');
    }

    const row = await this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<{
        id: string;
        email: string;
        password_hash: string;
        display_name: string | null;
      }>(
        `SELECT id, email, password_hash, display_name
         FROM customers
         WHERE lower(email) = $1
         LIMIT 1`,
        [normalized],
      );
      return res.rows[0] ?? null;
    });

    if (!row || !(await this.verifyPassword(password, row.password_hash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const claims: JwtClaims = {
      sub: row.id,
      email: row.email,
      tenantId,
      kind: 'customer',
      role: 'customer',
    };
    return {
      token: this.signToken(claims),
      user: this.claimsToView(claims, row.display_name),
    };
  }

  /** Attach an active guest cart to the signed-in customer (same tenant). */
  async linkGuestCart(
    tenantId: string,
    customerId: string,
    guestToken: string | null | undefined,
  ): Promise<void> {
    if (!guestToken) return;
    await this.db.withTenant(tenantId, async (client) => {
      await client.query(
        `UPDATE carts
         SET customer_id = $1, email = COALESCE(email, (SELECT email FROM customers WHERE id = $1)),
             updated_at = now()
         WHERE guest_token = $2
           AND status = 'active'
           AND (customer_id IS NULL OR customer_id = $1)`,
        [customerId, guestToken],
      );
    });
  }

  async meFromRequest(req: {
    headers: Record<string, string | string[] | undefined>;
    cookies?: Record<string, string>;
    tenantId?: string;
  }): Promise<AuthUserView> {
    const staffToken = this.resolveStaffToken(req);
    if (staffToken) {
      const claims = this.verifyToken(staffToken);
      if (claims.kind !== 'staff') {
        throw new UnauthorizedException('Staff session required');
      }
      if (req.tenantId && claims.tenantId !== req.tenantId) {
        throw new UnauthorizedException('Token tenant mismatch');
      }
      return this.claimsToView(claims);
    }

    const customerToken = this.resolveCustomerToken(req);
    if (customerToken) {
      const claims = this.verifyToken(customerToken);
      if (claims.kind !== 'customer') {
        throw new UnauthorizedException('Customer session required');
      }
      if (req.tenantId && claims.tenantId !== req.tenantId) {
        throw new UnauthorizedException('Token tenant mismatch');
      }
      return this.claimsToView(claims);
    }

    throw new UnauthorizedException('Not authenticated');
  }

  requireStaffClaims(
    req: {
      headers: Record<string, string | string[] | undefined>;
      cookies?: Record<string, string>;
      tenantId?: string;
    },
  ): JwtClaims {
    const token = this.resolveStaffToken(req);
    if (!token) throw new UnauthorizedException('Staff session required');
    const claims = this.verifyToken(token);
    if (claims.kind !== 'staff') {
      throw new UnauthorizedException('Staff session required');
    }
    if (req.tenantId && claims.tenantId !== req.tenantId) {
      throw new UnauthorizedException('Token tenant mismatch');
    }
    return claims;
  }

  optionalCustomerClaims(req: {
    headers: Record<string, string | string[] | undefined>;
    cookies?: Record<string, string>;
    tenantId?: string;
  }): JwtClaims | null {
    const token = this.resolveCustomerToken(req);
    if (!token) return null;
    try {
      const claims = this.verifyToken(token);
      if (claims.kind !== 'customer') return null;
      if (req.tenantId && claims.tenantId !== req.tenantId) return null;
      return claims;
    } catch {
      return null;
    }
  }
}
