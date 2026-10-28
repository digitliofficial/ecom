import { BadRequestException, Injectable } from '@nestjs/common';
import { StripeBillingStub } from '@ecom/payment-providers';
import { DatabaseService } from '../db/database.service';
import { UpgradeRequiredException } from './upgrade-required.exception';

export type HardMetric = 'products' | 'staff' | 'locales';
export type SoftMetric = 'orders_month';

export type PlanView = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  entitlements: Record<string, string>;
};

export type UsageMeter = {
  metric: HardMetric | SoftMetric;
  label: string;
  usage: number;
  limit: number | null;
  unlimited: boolean;
  enforcement: 'hard' | 'soft';
  atLimit: boolean;
  overSoftLimit: boolean;
};

export type SoftLimitWarning = {
  metric: SoftMetric;
  message: string;
  usage: number;
  limit: number;
};

export type TenantBillingSnapshot = {
  plan: PlanView;
  subscription: {
    status: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  meters: UsageMeter[];
  softWarnings: SoftLimitWarning[];
  features: { b2b: boolean };
  stripeBillingConfigured: boolean;
};

const PLAN_ORDER = ['starter', 'growth', 'advanced'] as const;

@Injectable()
export class MeteringService {
  private readonly stripeBilling = new StripeBillingStub(
    process.env.STRIPE_BILLING_SECRET_KEY,
  );

  constructor(private readonly db: DatabaseService) {}

  async listPlans(): Promise<PlanView[]> {
    const plans = await this.db.query<{
      id: string;
      code: string;
      name: string;
      description: string | null;
      sort_order: number;
    }>(
      `SELECT id, code, name, description, sort_order
       FROM plans
       ORDER BY sort_order, code`,
    );

    const entitlements = await this.db.query<{
      plan_id: string;
      key: string;
      value: string;
    }>(`SELECT plan_id, key, value FROM plan_entitlements`);

    return plans.rows.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      sortOrder: p.sort_order,
      entitlements: Object.fromEntries(
        entitlements.rows
          .filter((e) => e.plan_id === p.id)
          .map((e) => [e.key, e.value]),
      ),
    }));
  }

  async getSnapshot(tenantId: string): Promise<TenantBillingSnapshot> {
    const plan = await this.resolvePlan(tenantId);
    const [products, staff, locales, ordersMonth] = await Promise.all([
      this.countProducts(tenantId),
      this.countStaff(tenantId),
      this.countLocales(tenantId),
      this.countOrdersThisMonth(tenantId),
    ]);

    const meters: UsageMeter[] = [
      this.toMeter(
        'products',
        'Products',
        products,
        plan.entitlements.max_products,
        'hard',
      ),
      this.toMeter(
        'staff',
        'Staff seats',
        staff,
        plan.entitlements.max_staff,
        'hard',
      ),
      this.toMeter(
        'locales',
        'Languages',
        locales,
        plan.entitlements.max_locales,
        'hard',
      ),
      this.toMeter(
        'orders_month',
        'Orders this month',
        ordersMonth,
        plan.entitlements.soft_max_orders_month,
        'soft',
      ),
    ];

    const softWarnings = meters
      .filter((m) => m.enforcement === 'soft' && m.overSoftLimit && m.limit != null)
      .map((m) => ({
        metric: m.metric as SoftMetric,
        message: `Soft limit: ${m.usage}/${m.limit} ${m.label.toLowerCase()}. Consider upgrading — orders still accepted.`,
        usage: m.usage,
        limit: m.limit!,
      }));

    const subscription = await this.loadSubscription(tenantId);

    return {
      plan,
      subscription,
      meters,
      softWarnings,
      features: { b2b: plan.entitlements.feature_b2b === '1' },
      stripeBillingConfigured: this.stripeBilling.isConfigured(),
    };
  }

  /** Hard-block before creating a product / staff seat / locale. */
  async assertHardLimit(tenantId: string, metric: HardMetric): Promise<void> {
    const plan = await this.resolvePlan(tenantId);
    const entitlementKey =
      metric === 'products'
        ? 'max_products'
        : metric === 'staff'
          ? 'max_staff'
          : 'max_locales';
    const limit = this.parseLimit(plan.entitlements[entitlementKey]);
    if (limit === null) return;

    const usage =
      metric === 'products'
        ? await this.countProducts(tenantId)
        : metric === 'staff'
          ? await this.countStaff(tenantId)
          : await this.countLocales(tenantId);

    if (usage >= limit) {
      throw new UpgradeRequiredException({
        metric,
        limit,
        usage,
        planCode: plan.code,
        suggestedPlanCode: this.suggestUpgrade(plan.code),
      });
    }
  }

  /** Soft check — never blocks; returns warning when over monthly order cap. */
  async softCheckOrdersMonth(
    tenantId: string,
  ): Promise<SoftLimitWarning | null> {
    const plan = await this.resolvePlan(tenantId);
    const limit = this.parseLimit(plan.entitlements.soft_max_orders_month);
    if (limit === null) return null;
    const usage = await this.countOrdersThisMonth(tenantId);
    if (usage < limit) return null;
    return {
      metric: 'orders_month',
      message: `Soft limit: ${usage}/${limit} orders this month. Orders still accepted — upgrade to raise the threshold.`,
      usage,
      limit,
    };
  }

  async listLocales(tenantId: string) {
    return this.db.withTenant(tenantId, async (client) => {
      const defaults = await client.query<{ default_locale: string }>(
        `SELECT default_locale FROM tenant_settings WHERE tenant_id = $1`,
        [tenantId],
      );
      const defaultLocale = defaults.rows[0]?.default_locale ?? 'en';
      const res = await client.query<{
        locale: string;
        enabled: boolean;
      }>(
        `SELECT locale, enabled
         FROM tenant_locales
         ORDER BY locale`,
      );
      return res.rows.map((r) => ({
        id: r.locale,
        locale: r.locale,
        enabled: r.enabled,
        isDefault: r.locale === defaultLocale,
      }));
    });
  }

  async enableLocale(
    tenantId: string,
    localeRaw: string,
  ): Promise<{ id: string; locale: string; enabled: boolean; isDefault: boolean }> {
    const locale = localeRaw.trim().toLowerCase();
    if (!/^[a-z]{2}(-[a-z]{2})?$/.test(locale)) {
      throw new BadRequestException(
        'locale must be a BCP-47 language tag like en or en-us',
      );
    }

    const existing = await this.db.withTenant(tenantId, async (client) => {
      const defaults = await client.query<{ default_locale: string }>(
        `SELECT default_locale FROM tenant_settings WHERE tenant_id = $1`,
        [tenantId],
      );
      const defaultLocale = defaults.rows[0]?.default_locale ?? 'en';
      const res = await client.query<{
        locale: string;
        enabled: boolean;
      }>(`SELECT locale, enabled FROM tenant_locales WHERE locale = $1`, [
        locale,
      ]);
      const row = res.rows[0] ?? null;
      return row
        ? {
            locale: row.locale,
            enabled: row.enabled,
            isDefault: row.locale === defaultLocale,
          }
        : null;
    });

    if (existing?.enabled) {
      return {
        id: existing.locale,
        locale: existing.locale,
        enabled: existing.enabled,
        isDefault: existing.isDefault,
      };
    }

    // Hard-cap check outside the mutating transaction (no nested withTenant).
    await this.assertHardLimit(tenantId, 'locales');

    return this.db.withTenant(tenantId, async (client) => {
      const defaults = await client.query<{ default_locale: string }>(
        `SELECT default_locale FROM tenant_settings WHERE tenant_id = $1`,
        [tenantId],
      );
      const defaultLocale = defaults.rows[0]?.default_locale ?? 'en';

      if (existing) {
        await client.query(
          `UPDATE tenant_locales SET enabled = true
           WHERE tenant_id = $1 AND locale = $2`,
          [tenantId, locale],
        );
      } else {
        await client.query(
          `INSERT INTO tenant_locales (tenant_id, locale, enabled)
           VALUES ($1, $2, true)
           ON CONFLICT (tenant_id, locale) DO UPDATE SET enabled = true`,
          [tenantId, locale],
        );
      }

      return {
        id: locale,
        locale,
        enabled: true,
        isDefault: locale === defaultLocale,
      };
    });
  }

  async disableLocale(tenantId: string, localeRaw: string): Promise<void> {
    const locale = localeRaw.trim().toLowerCase();
    await this.db.withTenant(tenantId, async (client) => {
      const defaults = await client.query<{ default_locale: string }>(
        `SELECT default_locale FROM tenant_settings WHERE tenant_id = $1`,
        [tenantId],
      );
      const defaultLocale = defaults.rows[0]?.default_locale ?? 'en';
      if (locale === defaultLocale) {
        throw new BadRequestException('Cannot disable the default locale');
      }
      await client.query(
        `UPDATE tenant_locales SET enabled = false
         WHERE tenant_id = $1 AND locale = $2`,
        [tenantId, locale],
      );
    });
  }

  async listStaff(tenantId: string) {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<{
        id: string;
        email: string;
        display_name: string | null;
        role: string;
        created_at: Date;
      }>(
        `SELECT u.id, u.email, u.display_name, m.role, m.created_at
         FROM memberships m
         INNER JOIN users u ON u.id = m.user_id
         ORDER BY m.created_at`,
      );
      return res.rows.map((r) => ({
        id: r.id,
        email: r.email,
        displayName: r.display_name,
        role: r.role,
        createdAt: r.created_at.toISOString(),
      }));
    });
  }

  async inviteStaff(
    tenantId: string,
    input: { email: string; password: string; displayName?: string; role?: string },
  ) {
    const email = input.email.trim().toLowerCase();
    const password = input.password;
    if (!email.includes('@')) {
      throw new BadRequestException('Valid email is required');
    }
    if (!password || password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const role = (input.role ?? 'staff').trim().toLowerCase();
    if (role !== 'staff' && role !== 'owner') {
      throw new BadRequestException('role must be staff or owner');
    }

    await this.assertHardLimit(tenantId, 'staff');

    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 10);
    const displayName = input.displayName?.trim() || null;

    return this.db.withTenant(tenantId, async (client) => {
      // users is global (no tenant_id); insert outside RLS-sensitive path via same txn
      let userId: string;
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM users WHERE lower(email) = $1`,
        [email],
      );
      if (existing.rows[0]) {
        userId = existing.rows[0].id;
        const membership = await client.query(
          `SELECT id FROM memberships WHERE user_id = $1`,
          [userId],
        );
        if (membership.rows[0]) {
          throw new BadRequestException('User is already a staff member');
        }
      } else {
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO users (email, password_hash, display_name)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [email, passwordHash, displayName],
        );
        userId = inserted.rows[0]!.id;
      }

      await client.query(
        `INSERT INTO memberships (tenant_id, user_id, role)
         VALUES ($1, $2, $3)`,
        [tenantId, userId, role],
      );

      return {
        id: userId,
        email,
        displayName,
        role,
      };
    });
  }

  async createBillingCheckout(
    tenantId: string,
    input: { planCode: string; successUrl: string; cancelUrl: string },
  ) {
    const plans = await this.listPlans();
    const plan = plans.find((p) => p.code === input.planCode);
    if (!plan) throw new BadRequestException('Unknown plan code');
    if (!input.successUrl?.startsWith('http') || !input.cancelUrl?.startsWith('http')) {
      throw new BadRequestException('successUrl and cancelUrl must be absolute http(s) URLs');
    }

    const session = await this.stripeBilling.createCheckoutSession({
      tenantId,
      planCode: plan.code,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
    });

    return {
      ...session,
      planCode: plan.code,
      message:
        'Stripe Billing stub — no charge. Configure STRIPE_BILLING_SECRET_KEY to enable live Checkout.',
    };
  }

  async createBillingPortal(tenantId: string, returnUrl: string) {
    if (!returnUrl?.startsWith('http')) {
      throw new BadRequestException('returnUrl must be an absolute http(s) URL');
    }
    const sub = await this.loadSubscription(tenantId);
    const session = await this.stripeBilling.createCustomerPortalSession({
      tenantId,
      returnUrl,
      stripeCustomerId: sub?.stripeCustomerId,
    });
    return {
      ...session,
      message:
        'Stripe Billing portal stub — no live customer portal. Configure STRIPE_BILLING_SECRET_KEY later.',
    };
  }

  /** Demo/test helper: change tenant plan without Stripe (owner/admin only). */
  async changePlan(tenantId: string, planCode: string): Promise<TenantBillingSnapshot> {
    const plans = await this.listPlans();
    const plan = plans.find((p) => p.code === planCode);
    if (!plan) throw new BadRequestException('Unknown plan code');

    await this.db.withTenant(tenantId, async (client) => {
      await client.query(`UPDATE tenants SET plan_id = $1 WHERE id = $2`, [
        plan.id,
        tenantId,
      ]);
      await client.query(
        `INSERT INTO tenant_subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end, updated_at)
         VALUES ($1, $2, 'active', date_trunc('month', now()), date_trunc('month', now()) + interval '1 month', now())
         ON CONFLICT (tenant_id) DO UPDATE
         SET plan_id = EXCLUDED.plan_id,
             status = 'active',
             updated_at = now()`,
        [tenantId, plan.id],
      );
    });

    return this.getSnapshot(tenantId);
  }

  private async resolvePlan(tenantId: string): Promise<PlanView> {
    return this.db.withTenant(tenantId, async (client) => {
      const row = await client.query<{
        id: string;
        code: string;
        name: string;
        description: string | null;
        sort_order: number;
      }>(
        `SELECT p.id, p.code, p.name, p.description, p.sort_order
         FROM tenants t
         INNER JOIN plans p ON p.id = t.plan_id
         WHERE t.id = $1`,
        [tenantId],
      );
      const plan = row.rows[0];
      if (!plan) {
        throw new BadRequestException('Tenant has no plan assigned');
      }
      const ents = await client.query<{ key: string; value: string }>(
        `SELECT key, value FROM plan_entitlements WHERE plan_id = $1`,
        [plan.id],
      );
      return {
        id: plan.id,
        code: plan.code,
        name: plan.name,
        description: plan.description,
        sortOrder: plan.sort_order,
        entitlements: Object.fromEntries(ents.rows.map((e) => [e.key, e.value])),
      };
    });
  }

  private async loadSubscription(tenantId: string) {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<{
        status: string;
        stripe_customer_id: string | null;
        stripe_subscription_id: string | null;
        current_period_end: Date | null;
        cancel_at_period_end: boolean;
      }>(
        `SELECT status, stripe_customer_id, stripe_subscription_id,
                current_period_end, cancel_at_period_end
         FROM tenant_subscriptions`,
      );
      const row = res.rows[0];
      if (!row) return null;
      return {
        status: row.status,
        stripeCustomerId: row.stripe_customer_id,
        stripeSubscriptionId: row.stripe_subscription_id,
        currentPeriodEnd: row.current_period_end?.toISOString() ?? null,
        cancelAtPeriodEnd: row.cancel_at_period_end,
      };
    });
  }

  private async countProducts(tenantId: string): Promise<number> {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM products WHERE status <> 'archived'`,
      );
      return Number(res.rows[0]?.n ?? 0);
    });
  }

  private async countStaff(tenantId: string): Promise<number> {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM memberships`,
      );
      return Number(res.rows[0]?.n ?? 0);
    });
  }

  private async countLocales(tenantId: string): Promise<number> {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM tenant_locales WHERE enabled = true`,
      );
      return Number(res.rows[0]?.n ?? 0);
    });
  }

  private async countOrdersThisMonth(tenantId: string): Promise<number> {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM orders
         WHERE created_at >= date_trunc('month', now())
           AND status <> 'cancelled'`,
      );
      return Number(res.rows[0]?.n ?? 0);
    });
  }

  private parseLimit(raw: string | undefined): number | null {
    if (raw === undefined || raw === null || raw === '') return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    if (n < 0) return null; // unlimited
    return Math.trunc(n);
  }

  private toMeter(
    metric: HardMetric | SoftMetric,
    label: string,
    usage: number,
    rawLimit: string | undefined,
    enforcement: 'hard' | 'soft',
  ): UsageMeter {
    const limit = this.parseLimit(rawLimit);
    const unlimited = limit === null;
    const atLimit = !unlimited && usage >= limit!;
    const overSoftLimit = enforcement === 'soft' && atLimit;
    return {
      metric,
      label,
      usage,
      limit,
      unlimited,
      enforcement,
      atLimit: enforcement === 'hard' && atLimit,
      overSoftLimit,
    };
  }

  private suggestUpgrade(planCode: string): string | null {
    const idx = PLAN_ORDER.indexOf(planCode as (typeof PLAN_ORDER)[number]);
    if (idx < 0 || idx >= PLAN_ORDER.length - 1) return null;
    return PLAN_ORDER[idx + 1]!;
  }
}
