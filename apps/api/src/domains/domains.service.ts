import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../db/database.service';

export type DomainVerificationStatus = 'pending' | 'verified' | 'failed';
export type DomainSslStatus = 'pending' | 'active' | 'error';

export type TenantDomainDto = {
  id: string;
  host: string;
  isPrimary: boolean;
  verificationStatus: DomainVerificationStatus;
  verifiedAt: string | null;
  sslStatus: DomainSslStatus;
  createdAt: string;
};

export type CnameInstructions = {
  cnameHost: string;
  cnameTarget: string;
  ttlHint: string;
  notes: string[];
};

export type DomainsConfigResponse = {
  domains: TenantDomainDto[];
  cname: CnameInstructions;
  platformHosts: string[];
};

type DomainRow = {
  id: string;
  host: string;
  is_primary: boolean;
  verification_status: string;
  verified_at: Date | string | null;
  ssl_status: string;
  created_at: Date | string;
};

const PLATFORM_LOCAL_HOSTS = new Set([
  'demo.localhost',
  'localhost',
  'other.localhost',
]);

function asIso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function normalizeHost(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  const withoutScheme = trimmed.replace(/^https?:\/\//, '');
  const hostOnly = withoutScheme.split('/')[0]?.split(':')[0] ?? '';
  return hostOnly.replace(/\.$/, '');
}

function isValidHostname(host: string): boolean {
  if (!host || host.length > 253) return false;
  if (host.includes('..')) return false;
  // Simple hostname: labels of alnum/hyphen, at least one dot for custom domains
  // (also allow *.localhost for local fixtures).
  return /^(?=.{1,253}$)(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host);
}

@Injectable()
export class DomainsService {
  constructor(private readonly db: DatabaseService) {}

  cnameTarget(): string {
    return (
      process.env.PLATFORM_CNAME_TARGET?.trim() ||
      'edge.ecom.digitli.local'
    );
  }

  instructionsFor(host?: string): CnameInstructions {
    const target = this.cnameTarget();
    return {
      cnameHost: host && !PLATFORM_LOCAL_HOSTS.has(host) ? host : 'www.example.com',
      cnameTarget: target,
      ttlHint: '300–3600 seconds (lower while verifying)',
      notes: [
        `Create a CNAME record pointing your custom hostname to ${target}.`,
        'Apex (root) domains usually need an ALIAS/ANAME or flatten CNAME at your DNS provider — plain CNAME at apex is often unsupported.',
        'After DNS propagates, use Verify in admin. SSL provisioning is stubbed until CDN/WAF is wired.',
        'Keep the platform preview host (e.g. demo.localhost) until cutover is confirmed.',
      ],
    };
  }

  async getConfig(tenantId: string): Promise<DomainsConfigResponse> {
    return this.db.withTenant(tenantId, async (client) => {
      const domains = await this.listRows(client);
      return {
        domains: domains.map((row) => this.toDto(row)),
        cname: this.instructionsFor(
          domains.find((d) => !PLATFORM_LOCAL_HOSTS.has(d.host))?.host,
        ),
        platformHosts: [...PLATFORM_LOCAL_HOSTS],
      };
    });
  }

  async addDomain(
    tenantId: string,
    hostRaw: string,
    opts?: { isPrimary?: boolean },
  ): Promise<TenantDomainDto> {
    const host = normalizeHost(hostRaw);
    if (!isValidHostname(host)) {
      throw new BadRequestException('Invalid hostname');
    }
    if (PLATFORM_LOCAL_HOSTS.has(host)) {
      throw new BadRequestException(
        'Platform/local hosts are managed by seed; add a public custom domain instead',
      );
    }

    // Unique on host is global; probe outside RLS so cross-tenant clashes 409 cleanly.
    const taken = await this.db.query<{ id: string }>(
      `SELECT id::text FROM tenant_domains WHERE lower(host) = $1 LIMIT 1`,
      [host],
    );
    if (taken.rows[0]) {
      throw new ConflictException('Host is already registered');
    }

    try {
      return await this.db.withTenant(tenantId, async (client) => {
        const isPrimary = Boolean(opts?.isPrimary);
        if (isPrimary) {
          await client.query(
            `UPDATE tenant_domains SET is_primary = false WHERE tenant_id = $1::uuid`,
            [tenantId],
          );
        }

        const inserted = await client.query<DomainRow>(
          `INSERT INTO tenant_domains (
             tenant_id, host, is_primary, verification_status, ssl_status
           ) VALUES (
             $1::uuid, $2, $3, 'pending', 'pending'
           )
           RETURNING id::text, host, is_primary, verification_status,
                     verified_at, ssl_status, created_at`,
          [tenantId, host, isPrimary],
        );
        return this.toDto(inserted.rows[0]!);
      });
    } catch (err) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code?: string }).code === '23505'
      ) {
        throw new ConflictException('Host is already registered');
      }
      throw err;
    }
  }

  async removeDomain(tenantId: string, domainId: string): Promise<void> {
    await this.db.withTenant(tenantId, async (client) => {
      const found = await client.query<DomainRow>(
        `SELECT id::text, host, is_primary, verification_status,
                verified_at, ssl_status, created_at
         FROM tenant_domains WHERE id = $1::uuid`,
        [domainId],
      );
      const row = found.rows[0];
      if (!row) throw new NotFoundException('Domain not found');
      if (PLATFORM_LOCAL_HOSTS.has(row.host)) {
        throw new BadRequestException(
          'Cannot remove platform/local seed hosts',
        );
      }
      if (row.is_primary) {
        const others = await client.query<{ count: string }>(
          `SELECT count(*)::text AS count FROM tenant_domains
           WHERE tenant_id = $1::uuid AND id <> $2::uuid`,
          [tenantId, domainId],
        );
        if (Number(others.rows[0]?.count ?? 0) === 0) {
          throw new BadRequestException('Cannot remove the only domain');
        }
      }
      await client.query(`DELETE FROM tenant_domains WHERE id = $1::uuid`, [
        domainId,
      ]);
    });
  }

  /**
   * Stub verification: marks domain verified when host is well-formed.
   * Real DNS/CNAME lookup lands with CDN/WAF wiring.
   */
  async verifyDomain(
    tenantId: string,
    domainId: string,
  ): Promise<TenantDomainDto> {
    return this.db.withTenant(tenantId, async (client) => {
      const found = await client.query<DomainRow>(
        `SELECT id::text, host, is_primary, verification_status,
                verified_at, ssl_status, created_at
         FROM tenant_domains WHERE id = $1::uuid`,
        [domainId],
      );
      const row = found.rows[0];
      if (!row) throw new NotFoundException('Domain not found');

      if (PLATFORM_LOCAL_HOSTS.has(row.host)) {
        const updated = await client.query<DomainRow>(
          `UPDATE tenant_domains
           SET verification_status = 'verified',
               verified_at = COALESCE(verified_at, now()),
               ssl_status = 'active'
           WHERE id = $1::uuid
           RETURNING id::text, host, is_primary, verification_status,
                     verified_at, ssl_status, created_at`,
          [domainId],
        );
        return this.toDto(updated.rows[0]!);
      }

      // Stub: accept verify once hostname looks like a real custom domain.
      const ok = isValidHostname(row.host) && row.host.includes('.');
      const updated = await client.query<DomainRow>(
        `UPDATE tenant_domains
         SET verification_status = $2,
             verified_at = CASE WHEN $2 = 'verified' THEN now() ELSE verified_at END,
             ssl_status = CASE WHEN $2 = 'verified' THEN 'pending' ELSE ssl_status END
         WHERE id = $1::uuid
         RETURNING id::text, host, is_primary, verification_status,
                   verified_at, ssl_status, created_at`,
        [domainId, ok ? 'verified' : 'failed'],
      );
      return this.toDto(updated.rows[0]!);
    });
  }

  private async listRows(client: PoolClient): Promise<DomainRow[]> {
    const res = await client.query<DomainRow>(
      `SELECT id::text, host, is_primary, verification_status,
              verified_at, ssl_status, created_at
       FROM tenant_domains
       ORDER BY is_primary DESC, created_at ASC`,
    );
    return res.rows;
  }

  private toDto(row: DomainRow): TenantDomainDto {
    return {
      id: row.id,
      host: row.host,
      isPrimary: row.is_primary,
      verificationStatus: row.verification_status as DomainVerificationStatus,
      verifiedAt: asIso(row.verified_at),
      sslStatus: row.ssl_status as DomainSslStatus,
      createdAt: asIso(row.created_at) ?? new Date().toISOString(),
    };
  }
}
