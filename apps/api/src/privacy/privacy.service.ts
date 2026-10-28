import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { AuthService } from '../auth/auth.service';
import { hashAccessToken } from '../common/guest-token';
import { DatabaseService } from '../db/database.service';

export type CookieBannerLayout = 'bottom' | 'modal';

export type TenantPrivacySettings = {
  dpaAcknowledged: boolean;
  dpaAcknowledgedAt: string | null;
  retentionDays: number;
  privacyContactEmail: string | null;
  cookieBannerEnabled: boolean;
  cookieBannerLayout: CookieBannerLayout;
  analyticsCategoryEnabled: boolean;
  marketingCategoryEnabled: boolean;
  privacyPolicyUrl: string | null;
  cookiePolicyUrl: string | null;
  updatedAt: string;
};

export type PrivacySettingsUpdate = {
  dpaAcknowledged?: boolean;
  retentionDays?: number;
  privacyContactEmail?: string | null;
  cookieBannerEnabled?: boolean;
  cookieBannerLayout?: CookieBannerLayout;
  analyticsCategoryEnabled?: boolean;
  marketingCategoryEnabled?: boolean;
  privacyPolicyUrl?: string | null;
  cookiePolicyUrl?: string | null;
};

/** Public banner config (no staff-only fields). */
export type StorefrontPrivacyConfig = {
  cookieBannerEnabled: boolean;
  cookieBannerLayout: CookieBannerLayout;
  analyticsCategoryEnabled: boolean;
  marketingCategoryEnabled: boolean;
  privacyPolicyUrl: string | null;
  cookiePolicyUrl: string | null;
  privacyContactEmail: string | null;
};

export type ConsentCategories = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
};

export type ConsentEventView = {
  id: string;
  subjectKey: string;
  categories: ConsentCategories;
  source: string;
  createdAt: string;
};

export type DsarRequestType = 'export' | 'delete';
export type DsarStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type DsarRequestSummary = {
  id: string;
  requestType: DsarRequestType;
  status: DsarStatus;
  subjectEmail: string;
  subjectKind: 'customer' | 'guest';
  customerId: string | null;
  actorKind: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  artifactExpiresAt: string | null;
  hasArtifact: boolean;
  errorMessage: string | null;
};

export type DsarRequestDetail = DsarRequestSummary & {
  artifact: Record<string, unknown> | null;
};

type PrivacyRow = {
  tenant_id: string;
  dpa_acknowledged: boolean;
  dpa_acknowledged_at: Date | string | null;
  retention_days: number;
  privacy_contact_email: string | null;
  cookie_banner_enabled: boolean;
  cookie_banner_layout: string;
  analytics_category_enabled: boolean;
  marketing_category_enabled: boolean;
  privacy_policy_url: string | null;
  cookie_policy_url: string | null;
  updated_at: Date | string;
};

type DsarRow = {
  id: string;
  tenant_id: string;
  request_type: string;
  status: string;
  subject_email: string;
  customer_id: string | null;
  subject_kind: string;
  actor_kind: string;
  actor_id: string | null;
  artifact: Record<string, unknown> | null;
  artifact_expires_at: Date | string | null;
  error_message: string | null;
  completed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type QueryClient = {
  query: <T>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: T[]; rowCount: number | null }>;
};

function asIso(value: Date | string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function trimOrNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const t = value.trim();
  return t.length ? t : null;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class PrivacyService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auth: AuthService,
  ) {}

  async getSettings(tenantId: string): Promise<TenantPrivacySettings> {
    return this.db.withTenant(tenantId, async (client) => {
      const row = await this.loadOrCreateSettings(client, tenantId);
      return this.settingsToDto(row);
    });
  }

  async getStorefrontConfig(tenantId: string): Promise<StorefrontPrivacyConfig> {
    const settings = await this.getSettings(tenantId);
    return {
      cookieBannerEnabled: settings.cookieBannerEnabled,
      cookieBannerLayout: settings.cookieBannerLayout,
      analyticsCategoryEnabled: settings.analyticsCategoryEnabled,
      marketingCategoryEnabled: settings.marketingCategoryEnabled,
      privacyPolicyUrl: settings.privacyPolicyUrl,
      cookiePolicyUrl: settings.cookiePolicyUrl,
      privacyContactEmail: settings.privacyContactEmail,
    };
  }

  async updateSettings(
    tenantId: string,
    input: PrivacySettingsUpdate,
  ): Promise<TenantPrivacySettings> {
    return this.db.withTenant(tenantId, async (client) => {
      const current = await this.loadOrCreateSettings(client, tenantId);

      const layout =
        input.cookieBannerLayout !== undefined
          ? input.cookieBannerLayout
          : (current.cookie_banner_layout as CookieBannerLayout);
      if (layout !== 'bottom' && layout !== 'modal') {
        throw new BadRequestException('cookieBannerLayout must be bottom or modal');
      }

      const retentionDays =
        input.retentionDays !== undefined
          ? Number(input.retentionDays)
          : current.retention_days;
      if (
        !Number.isInteger(retentionDays) ||
        retentionDays < 30 ||
        retentionDays > 3650
      ) {
        throw new BadRequestException('retentionDays must be an integer 30–3650');
      }

      const dpaAcknowledged =
        input.dpaAcknowledged !== undefined
          ? Boolean(input.dpaAcknowledged)
          : current.dpa_acknowledged;

      let dpaAt = current.dpa_acknowledged_at;
      if (dpaAcknowledged && !current.dpa_acknowledged) {
        dpaAt = new Date();
      } else if (!dpaAcknowledged) {
        dpaAt = null;
      }

      const next = {
        dpaAcknowledged,
        dpaAt,
        retentionDays,
        privacyContactEmail:
          input.privacyContactEmail !== undefined
            ? trimOrNull(input.privacyContactEmail)
            : current.privacy_contact_email,
        cookieBannerEnabled:
          input.cookieBannerEnabled !== undefined
            ? Boolean(input.cookieBannerEnabled)
            : current.cookie_banner_enabled,
        cookieBannerLayout: layout,
        analyticsCategoryEnabled:
          input.analyticsCategoryEnabled !== undefined
            ? Boolean(input.analyticsCategoryEnabled)
            : current.analytics_category_enabled,
        marketingCategoryEnabled:
          input.marketingCategoryEnabled !== undefined
            ? Boolean(input.marketingCategoryEnabled)
            : current.marketing_category_enabled,
        privacyPolicyUrl:
          input.privacyPolicyUrl !== undefined
            ? trimOrNull(input.privacyPolicyUrl)
            : current.privacy_policy_url,
        cookiePolicyUrl:
          input.cookiePolicyUrl !== undefined
            ? trimOrNull(input.cookiePolicyUrl)
            : current.cookie_policy_url,
      };

      if (
        next.privacyContactEmail &&
        !next.privacyContactEmail.includes('@')
      ) {
        throw new BadRequestException('privacyContactEmail must be a valid email');
      }

      const res = await client.query<PrivacyRow>(
        `UPDATE tenant_privacy_settings
         SET dpa_acknowledged = $2,
             dpa_acknowledged_at = $3,
             retention_days = $4,
             privacy_contact_email = $5,
             cookie_banner_enabled = $6,
             cookie_banner_layout = $7,
             analytics_category_enabled = $8,
             marketing_category_enabled = $9,
             privacy_policy_url = $10,
             cookie_policy_url = $11,
             updated_at = now()
         WHERE tenant_id = $1
         RETURNING *`,
        [
          tenantId,
          next.dpaAcknowledged,
          next.dpaAt,
          next.retentionDays,
          next.privacyContactEmail,
          next.cookieBannerEnabled,
          next.cookieBannerLayout,
          next.analyticsCategoryEnabled,
          next.marketingCategoryEnabled,
          next.privacyPolicyUrl,
          next.cookiePolicyUrl,
        ],
      );

      const row = res.rows[0];
      if (!row) throw new NotFoundException('Privacy settings not found');
      return this.settingsToDto(row);
    });
  }

  async recordConsent(
    tenantId: string,
    input: {
      subjectKey: string;
      analytics?: boolean;
      marketing?: boolean;
      source?: string;
      customerId?: string | null;
    },
  ): Promise<ConsentEventView> {
    const subjectKey = input.subjectKey?.trim();
    if (!subjectKey || subjectKey.length < 8 || subjectKey.length > 128) {
      throw new BadRequestException('subjectKey must be 8–128 characters');
    }

    const settings = await this.getSettings(tenantId);
    const analytics =
      settings.analyticsCategoryEnabled && Boolean(input.analytics);
    const marketing =
      settings.marketingCategoryEnabled && Boolean(input.marketing);
    const source = input.source ?? 'banner';
    if (!['banner', 'settings', 'import', 'admin'].includes(source)) {
      throw new BadRequestException('Invalid consent source');
    }

    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<{
        id: string;
        subject_key: string;
        necessary: boolean;
        analytics: boolean;
        marketing: boolean;
        source: string;
        created_at: Date | string;
      }>(
        `INSERT INTO consent_events (
           tenant_id, subject_key, customer_id,
           necessary, analytics, marketing, source
         ) VALUES ($1, $2, $3, true, $4, $5, $6)
         RETURNING id, subject_key, necessary, analytics, marketing, source, created_at`,
        [
          tenantId,
          subjectKey,
          input.customerId ?? null,
          analytics,
          marketing,
          source,
        ],
      );
      const row = res.rows[0]!;
      return {
        id: row.id,
        subjectKey: row.subject_key,
        categories: {
          necessary: true,
          analytics: row.analytics,
          marketing: row.marketing,
        },
        source: row.source,
        createdAt: asIso(row.created_at)!,
      };
    });
  }

  async createCustomerExport(
    tenantId: string,
    customerId: string,
    email: string,
  ): Promise<DsarRequestDetail> {
    return this.db.withTenant(tenantId, async (client) => {
      const request = await this.insertDsar(client, {
        tenantId,
        requestType: 'export',
        subjectEmail: email,
        customerId,
        subjectKind: 'customer',
        actorKind: 'subject',
        actorId: customerId,
      });
      return this.processExport(client, tenantId, request);
    });
  }

  async createCustomerDelete(
    tenantId: string,
    customerId: string,
    email: string,
    password: string,
  ): Promise<DsarRequestDetail> {
    if (!password) {
      throw new BadRequestException('Password confirmation is required to delete');
    }

    const row = await this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<{
        id: string;
        email: string;
        password_hash: string;
        anonymized_at: Date | string | null;
      }>(
        `SELECT id, email, password_hash, anonymized_at FROM customers WHERE id = $1`,
        [customerId],
      );
      return res.rows[0] ?? null;
    });

    if (!row) throw new NotFoundException('Customer not found');
    if (row.anonymized_at) {
      throw new BadRequestException('Account already anonymized');
    }
    if (!(await this.auth.verifyPassword(password, row.password_hash))) {
      throw new UnauthorizedException('Invalid password');
    }

    return this.db.withTenant(tenantId, async (client) => {
      const request = await this.insertDsar(client, {
        tenantId,
        requestType: 'delete',
        subjectEmail: email,
        customerId,
        subjectKind: 'customer',
        actorKind: 'subject',
        actorId: customerId,
      });
      return this.processDelete(client, tenantId, request);
    });
  }

  async createGuestDsar(
    tenantId: string,
    input: {
      requestType: DsarRequestType;
      email: string;
      orderAccessToken: string;
    },
  ): Promise<DsarRequestDetail> {
    const email = normalizeEmail(input.email);
    if (!email.includes('@')) {
      throw new BadRequestException('Valid email is required');
    }
    if (!input.orderAccessToken?.trim()) {
      throw new BadRequestException('orderAccessToken is required');
    }
    if (input.requestType !== 'export' && input.requestType !== 'delete') {
      throw new BadRequestException('requestType must be export or delete');
    }

    const tokenHash = hashAccessToken(input.orderAccessToken.trim());

    return this.db.withTenant(tenantId, async (client) => {
      const orderRes = await client.query<{
        id: string;
        guest_email: string | null;
        customer_id: string | null;
      }>(
        `SELECT id, guest_email, customer_id
         FROM orders
         WHERE access_token_hash = $1
           AND lower(coalesce(guest_email, '')) = $2
         LIMIT 1`,
        [tokenHash, email],
      );
      const order = orderRes.rows[0];
      if (!order) {
        throw new ForbiddenException(
          'No guest order found for that email and access token',
        );
      }

      const request = await this.insertDsar(client, {
        tenantId,
        requestType: input.requestType,
        subjectEmail: email,
        customerId: order.customer_id,
        subjectKind: 'guest',
        actorKind: 'subject',
        actorId: null,
      });

      if (input.requestType === 'export') {
        return this.processExport(client, tenantId, request, {
          guestEmail: email,
          orderAccessTokenHash: tokenHash,
        });
      }
      return this.processDelete(client, tenantId, request, {
        guestEmail: email,
        orderAccessTokenHash: tokenHash,
      });
    });
  }

  async listCustomerDsar(
    tenantId: string,
    customerId: string,
  ): Promise<DsarRequestSummary[]> {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<DsarRow>(
        `SELECT * FROM dsar_requests
         WHERE customer_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [customerId],
      );
      return res.rows.map((r) => this.dsarToSummary(r));
    });
  }

  async getCustomerDsar(
    tenantId: string,
    customerId: string,
    requestId: string,
  ): Promise<DsarRequestDetail> {
    return this.db.withTenant(tenantId, async (client) => {
      const row = await this.loadDsar(client, requestId);
      if (!row || row.customer_id !== customerId) {
        throw new NotFoundException('DSAR request not found');
      }
      return this.dsarToDetail(row, true);
    });
  }

  async listAdminDsar(tenantId: string): Promise<DsarRequestSummary[]> {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<DsarRow>(
        `SELECT * FROM dsar_requests
         ORDER BY created_at DESC
         LIMIT 100`,
      );
      return res.rows.map((r) => this.dsarToSummary(r));
    });
  }

  async getAdminDsar(
    tenantId: string,
    requestId: string,
  ): Promise<DsarRequestDetail> {
    return this.db.withTenant(tenantId, async (client) => {
      const row = await this.loadDsar(client, requestId);
      if (!row) throw new NotFoundException('DSAR request not found');
      return this.dsarToDetail(row, true);
    });
  }

  private async processExport(
    client: QueryClient,
    tenantId: string,
    request: DsarRow,
    guest?: { guestEmail: string; orderAccessTokenHash: string },
  ): Promise<DsarRequestDetail> {
    await client.query(
      `UPDATE dsar_requests SET status = 'processing', updated_at = now() WHERE id = $1`,
      [request.id],
    );

    try {
      const artifact = await this.buildExportArtifact(client, tenantId, request, guest);
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const res = await client.query<DsarRow>(
        `UPDATE dsar_requests
         SET status = 'completed',
             artifact = $2::jsonb,
             artifact_expires_at = $3,
             completed_at = now(),
             updated_at = now(),
             error_message = NULL
         WHERE id = $1
         RETURNING *`,
        [request.id, JSON.stringify(artifact), expires.toISOString()],
      );
      return this.dsarToDetail(res.rows[0]!, true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      await client.query(
        `UPDATE dsar_requests
         SET status = 'failed', error_message = $2, updated_at = now()
         WHERE id = $1`,
        [request.id, message],
      );
      throw err;
    }
  }

  private async processDelete(
    client: QueryClient,
    tenantId: string,
    request: DsarRow,
    guest?: { guestEmail: string; orderAccessTokenHash: string },
  ): Promise<DsarRequestDetail> {
    await client.query(
      `UPDATE dsar_requests SET status = 'processing', updated_at = now() WHERE id = $1`,
      [request.id],
    );

    try {
      const summary = await this.anonymizeSubject(client, tenantId, request, guest);
      const res = await client.query<DsarRow>(
        `UPDATE dsar_requests
         SET status = 'completed',
             artifact = $2::jsonb,
             artifact_expires_at = NULL,
             completed_at = now(),
             updated_at = now(),
             error_message = NULL
         WHERE id = $1
         RETURNING *`,
        [request.id, JSON.stringify(summary)],
      );
      return this.dsarToDetail(res.rows[0]!, true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      await client.query(
        `UPDATE dsar_requests
         SET status = 'failed', error_message = $2, updated_at = now()
         WHERE id = $1`,
        [request.id, message],
      );
      throw err;
    }
  }

  private async buildExportArtifact(
    client: QueryClient,
    tenantId: string,
    request: DsarRow,
    guest?: { guestEmail: string; orderAccessTokenHash: string },
  ): Promise<Record<string, unknown>> {
    const email = normalizeEmail(request.subject_email);

    let profile: Record<string, unknown> | null = null;
    if (request.customer_id) {
      const cust = await client.query<{
        id: string;
        email: string;
        display_name: string | null;
        email_verified_at: Date | string | null;
        created_at: Date | string;
        anonymized_at: Date | string | null;
      }>(
        `SELECT id, email, display_name, email_verified_at, created_at, anonymized_at
         FROM customers WHERE id = $1`,
        [request.customer_id],
      );
      const c = cust.rows[0];
      if (c) {
        profile = {
          id: c.id,
          email: c.email,
          displayName: c.display_name,
          emailVerifiedAt: asIso(c.email_verified_at),
          createdAt: asIso(c.created_at),
          anonymizedAt: asIso(c.anonymized_at),
        };
      }
    }

    const ordersRes = await client.query<{
      id: string;
      status: string;
      payment_status: string;
      payment_method: string | null;
      guest_email: string | null;
      customer_id: string | null;
      total_amount_minor: string | number;
      charge_currency: string;
      shipping_address: Record<string, unknown> | null;
      created_at: Date | string;
      updated_at: Date | string;
    }>(
      guest
        ? `SELECT id, status, payment_status, payment_method, guest_email, customer_id,
                  total_amount_minor, charge_currency, shipping_address, created_at, updated_at
           FROM orders
           WHERE lower(coalesce(guest_email, '')) = $1
              OR access_token_hash = $2
           ORDER BY created_at DESC`
        : request.customer_id
          ? `SELECT id, status, payment_status, payment_method, guest_email, customer_id,
                    total_amount_minor, charge_currency, shipping_address, created_at, updated_at
             FROM orders
             WHERE customer_id = $1 OR lower(coalesce(guest_email, '')) = $2
             ORDER BY created_at DESC`
          : `SELECT id, status, payment_status, payment_method, guest_email, customer_id,
                    total_amount_minor, charge_currency, shipping_address, created_at, updated_at
             FROM orders
             WHERE lower(coalesce(guest_email, '')) = $1
             ORDER BY created_at DESC`,
      guest
        ? [guest.guestEmail, guest.orderAccessTokenHash]
        : request.customer_id
          ? [request.customer_id, email]
          : [email],
    );

    const orderIds = ordersRes.rows.map((o) => o.id);
    let lines: Array<Record<string, unknown>> = [];
    if (orderIds.length) {
      const linesRes = await client.query<{
        id: string;
        order_id: string;
        variant_id: string;
        title: string;
        quantity: number;
        unit_amount_minor: string | number;
        currency: string;
        qty_ordered: number;
        qty_fulfilled: number;
      }>(
        `SELECT id, order_id, variant_id, title, quantity, unit_amount_minor,
                currency, qty_ordered, qty_fulfilled
         FROM order_lines WHERE order_id = ANY($1::uuid[])`,
        [orderIds],
      );
      lines = linesRes.rows.map((l) => ({
        id: l.id,
        orderId: l.order_id,
        variantId: l.variant_id,
        title: l.title,
        quantity: l.quantity,
        unitAmountMinor: Number(l.unit_amount_minor),
        currency: l.currency,
        qtyOrdered: l.qty_ordered,
        qtyFulfilled: l.qty_fulfilled,
      }));
    }

    const consentsRes = await client.query<{
      id: string;
      subject_key: string;
      necessary: boolean;
      analytics: boolean;
      marketing: boolean;
      source: string;
      created_at: Date | string;
    }>(
      request.customer_id
        ? `SELECT id, subject_key, necessary, analytics, marketing, source, created_at
           FROM consent_events
           WHERE customer_id = $1
           ORDER BY created_at DESC
           LIMIT 100`
        : `SELECT id, subject_key, necessary, analytics, marketing, source, created_at
           FROM consent_events
           WHERE subject_key = $1
           ORDER BY created_at DESC
           LIMIT 100`,
      [request.customer_id ?? `guest:${email}`],
    );

    return {
      exportedAt: new Date().toISOString(),
      tenantId,
      requestId: request.id,
      subject: {
        email,
        kind: request.subject_kind,
        customerId: request.customer_id,
      },
      profile,
      orders: ordersRes.rows.map((o) => ({
        id: o.id,
        status: o.status,
        paymentStatus: o.payment_status,
        paymentMethod: o.payment_method,
        guestEmail: o.guest_email,
        customerId: o.customer_id,
        totalAmountMinor: Number(o.total_amount_minor),
        chargeCurrency: o.charge_currency,
        shippingAddress: o.shipping_address,
        createdAt: asIso(o.created_at),
        updatedAt: asIso(o.updated_at),
      })),
      orderLines: lines,
      consents: consentsRes.rows.map((c) => ({
        id: c.id,
        subjectKey: c.subject_key,
        categories: {
          necessary: c.necessary,
          analytics: c.analytics,
          marketing: c.marketing,
        },
        source: c.source,
        createdAt: asIso(c.created_at),
      })),
      wishlists: [],
      reviews: [],
    };
  }

  private async anonymizeSubject(
    client: QueryClient,
    _tenantId: string,
    request: DsarRow,
    guest?: { guestEmail: string; orderAccessTokenHash: string },
  ): Promise<Record<string, unknown>> {
    const email = normalizeEmail(request.subject_email);
    let customersUpdated = 0;
    let ordersUpdated = 0;
    let cartsUpdated = 0;
    let checkoutsUpdated = 0;

    if (request.customer_id) {
      const redactedEmail = `deleted-${request.customer_id}@redacted.local`;
      const scrubHash = await this.auth.hashPassword(
        `deleted-${randomBytes(16).toString('hex')}`,
      );
      const cust = await client.query(
        `UPDATE customers
         SET email = $2,
             display_name = NULL,
             password_hash = $3,
             anonymized_at = now()
         WHERE id = $1 AND anonymized_at IS NULL`,
        [request.customer_id, redactedEmail, scrubHash],
      );
      customersUpdated = cust.rowCount ?? 0;

      const orders = await client.query(
        `UPDATE orders
         SET guest_email = CASE
               WHEN guest_email IS NOT NULL THEN 'redacted@redacted.local'
               ELSE guest_email
             END,
             shipping_address = CASE
               WHEN shipping_address IS NOT NULL THEN $2::jsonb
               ELSE shipping_address
             END,
             updated_at = now()
         WHERE customer_id = $1`,
        [
          request.customer_id,
          JSON.stringify({
            line1: '[redacted]',
            city: '[redacted]',
            country: 'XX',
            postalCode: '[redacted]',
          }),
        ],
      );
      ordersUpdated += orders.rowCount ?? 0;

      const carts = await client.query(
        `UPDATE carts SET email = NULL, updated_at = now()
         WHERE customer_id = $1`,
        [request.customer_id],
      );
      cartsUpdated += carts.rowCount ?? 0;
    }

    if (guest || request.subject_kind === 'guest') {
      const guestEmail = guest?.guestEmail ?? email;
      const orders = await client.query(
        `UPDATE orders
         SET guest_email = 'redacted@redacted.local',
             shipping_address = CASE
               WHEN shipping_address IS NOT NULL THEN $2::jsonb
               ELSE shipping_address
             END,
             updated_at = now()
         WHERE lower(coalesce(guest_email, '')) = $1
            OR ($3::text IS NOT NULL AND access_token_hash = $3)`,
        [
          guestEmail,
          JSON.stringify({
            line1: '[redacted]',
            city: '[redacted]',
            country: 'XX',
            postalCode: '[redacted]',
          }),
          guest?.orderAccessTokenHash ?? null,
        ],
      );
      ordersUpdated += orders.rowCount ?? 0;

      const carts = await client.query(
        `UPDATE carts SET email = NULL, updated_at = now()
         WHERE lower(coalesce(email, '')) = $1`,
        [guestEmail],
      );
      cartsUpdated += carts.rowCount ?? 0;

      const checkouts = await client.query(
        `UPDATE checkout_sessions
         SET guest_email = 'redacted@redacted.local',
             shipping_address = CASE
               WHEN shipping_address IS NOT NULL THEN $2::jsonb
               ELSE shipping_address
             END
         WHERE lower(coalesce(guest_email, '')) = $1`,
        [
          guestEmail,
          JSON.stringify({
            line1: '[redacted]',
            city: '[redacted]',
            country: 'XX',
            postalCode: '[redacted]',
          }),
        ],
      );
      checkoutsUpdated += checkouts.rowCount ?? 0;
    } else if (request.customer_id) {
      const checkouts = await client.query(
        `UPDATE checkout_sessions cs
         SET guest_email = CASE
               WHEN guest_email IS NOT NULL THEN 'redacted@redacted.local'
               ELSE guest_email
             END,
             shipping_address = CASE
               WHEN shipping_address IS NOT NULL THEN $2::jsonb
               ELSE shipping_address
             END
         FROM carts c
         WHERE cs.cart_id = c.id AND c.customer_id = $1`,
        [
          request.customer_id,
          JSON.stringify({
            line1: '[redacted]',
            city: '[redacted]',
            country: 'XX',
            postalCode: '[redacted]',
          }),
        ],
      );
      checkoutsUpdated += checkouts.rowCount ?? 0;
    }

    return {
      deletedAt: new Date().toISOString(),
      requestId: request.id,
      subjectEmail: email,
      customersUpdated,
      ordersUpdated,
      cartsUpdated,
      checkoutsUpdated,
      note: 'PII anonymized; order financial totals retained for legal/tax.',
    };
  }

  private async insertDsar(
    client: QueryClient,
    input: {
      tenantId: string;
      requestType: DsarRequestType;
      subjectEmail: string;
      customerId: string | null;
      subjectKind: 'customer' | 'guest';
      actorKind: string;
      actorId: string | null;
    },
  ): Promise<DsarRow> {
    const res = await client.query<DsarRow>(
      `INSERT INTO dsar_requests (
         tenant_id, request_type, status, subject_email, customer_id,
         subject_kind, actor_kind, actor_id
       ) VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.tenantId,
        input.requestType,
        normalizeEmail(input.subjectEmail),
        input.customerId,
        input.subjectKind,
        input.actorKind,
        input.actorId,
      ],
    );
    return res.rows[0]!;
  }

  private async loadDsar(
    client: QueryClient,
    requestId: string,
  ): Promise<DsarRow | null> {
    const res = await client.query<DsarRow>(
      `SELECT * FROM dsar_requests WHERE id = $1`,
      [requestId],
    );
    return res.rows[0] ?? null;
  }

  private async loadOrCreateSettings(
    client: QueryClient,
    tenantId: string,
  ): Promise<PrivacyRow> {
    const existing = await client.query<PrivacyRow>(
      `SELECT * FROM tenant_privacy_settings WHERE tenant_id = $1`,
      [tenantId],
    );
    if (existing.rows[0]) return existing.rows[0];

    const inserted = await client.query<PrivacyRow>(
      `INSERT INTO tenant_privacy_settings (tenant_id)
       VALUES ($1)
       ON CONFLICT (tenant_id) DO UPDATE SET updated_at = tenant_privacy_settings.updated_at
       RETURNING *`,
      [tenantId],
    );
    const row = inserted.rows[0];
    if (!row) throw new NotFoundException('Could not create privacy settings');
    return row;
  }

  private settingsToDto(row: PrivacyRow): TenantPrivacySettings {
    return {
      dpaAcknowledged: row.dpa_acknowledged,
      dpaAcknowledgedAt: asIso(row.dpa_acknowledged_at),
      retentionDays: row.retention_days,
      privacyContactEmail: row.privacy_contact_email,
      cookieBannerEnabled: row.cookie_banner_enabled,
      cookieBannerLayout: row.cookie_banner_layout as CookieBannerLayout,
      analyticsCategoryEnabled: row.analytics_category_enabled,
      marketingCategoryEnabled: row.marketing_category_enabled,
      privacyPolicyUrl: row.privacy_policy_url,
      cookiePolicyUrl: row.cookie_policy_url,
      updatedAt: asIso(row.updated_at)!,
    };
  }

  private dsarToSummary(row: DsarRow): DsarRequestSummary {
    const expired =
      row.artifact_expires_at &&
      new Date(asIso(row.artifact_expires_at)!).getTime() < Date.now();
    return {
      id: row.id,
      requestType: row.request_type as DsarRequestType,
      status: row.status as DsarStatus,
      subjectEmail: row.subject_email,
      subjectKind: row.subject_kind as 'customer' | 'guest',
      customerId: row.customer_id,
      actorKind: row.actor_kind,
      createdAt: asIso(row.created_at)!,
      updatedAt: asIso(row.updated_at)!,
      completedAt: asIso(row.completed_at),
      artifactExpiresAt: asIso(row.artifact_expires_at),
      hasArtifact: Boolean(row.artifact) && !expired,
      errorMessage: row.error_message,
    };
  }

  private dsarToDetail(row: DsarRow, includeArtifact: boolean): DsarRequestDetail {
    const summary = this.dsarToSummary(row);
    let artifact: Record<string, unknown> | null = null;
    if (includeArtifact && summary.hasArtifact) {
      artifact = row.artifact;
    }
    return { ...summary, artifact };
  }
}

/** Stable opaque subject key helper (tests / docs). */
export function hashSubjectKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex').slice(0, 32);
}
