import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../db/database.service';

/** Platform catalog merchants can enable from (MVP hard-coded). */
export const AVAILABLE_LOCALES = ['en', 'ur', 'ar', 'fr', 'de', 'es'] as const;
export const AVAILABLE_CURRENCIES = [
  'USD',
  'PKR',
  'EUR',
  'GBP',
  'AED',
] as const;

export type TenantLocalizationSettings = {
  defaultLocale: string;
  defaultCurrency: string;
  multiLanguage: boolean;
  multiCurrency: boolean;
  enabledLocales: string[];
  enabledCurrencies: string[];
  availableLocales: string[];
  availableCurrencies: string[];
  maxLocales: number;
  maxCurrencies: number;
  fxRounding: string;
  fxDisclaimer: string | null;
  updatedAt: string;
};

export type LocalizationSettingsUpdate = {
  defaultLocale?: string;
  defaultCurrency?: string;
  multiLanguage?: boolean;
  multiCurrency?: boolean;
  enabledLocales?: string[];
  enabledCurrencies?: string[];
  fxRounding?: string;
  fxDisclaimer?: string | null;
};

export type StorefrontLocalization = {
  defaultLocale: string;
  defaultCurrency: string;
  multiLanguage: boolean;
  multiCurrency: boolean;
  locales: string[];
  currencies: string[];
  fxDisclaimer: string | null;
};

type SettingsRow = {
  tenant_id: string;
  default_locale: string;
  default_currency: string;
  multi_language: boolean;
  multi_currency: boolean;
  fx_rounding: string;
  fx_disclaimer: string | null;
  updated_at: Date | string;
};

type TenantClient = {
  query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
};

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function normalizeLocale(raw: string): string {
  const t = raw.trim().replace('_', '-');
  const m = /^([a-zA-Z]{2})(?:-([a-zA-Z]{2}))?$/.exec(t);
  if (!m) {
    throw new BadRequestException(`Invalid locale: ${raw}`);
  }
  const base = m[1]!.toLowerCase();
  const region = m[2] ? `-${m[2].toUpperCase()}` : '';
  return `${base}${region}`;
}

function normalizeCurrency(raw: string): string {
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    throw new BadRequestException(`Invalid currency: ${raw}`);
  }
  return code;
}

function assertInCatalog(locale: string, currency: string) {
  if (!(AVAILABLE_LOCALES as readonly string[]).includes(locale)) {
    throw new BadRequestException(
      `Locale ${locale} is not in the platform catalog`,
    );
  }
  if (!(AVAILABLE_CURRENCIES as readonly string[]).includes(currency)) {
    throw new BadRequestException(
      `Currency ${currency} is not in the platform catalog`,
    );
  }
}

@Injectable()
export class LocalizationService {
  constructor(private readonly db: DatabaseService) {}

  async getSettings(tenantId: string): Promise<TenantLocalizationSettings> {
    return this.db.withTenant(tenantId, async (client) => {
      const row = await this.loadOrCreate(client, tenantId);
      const locales = await this.listLocales(client, tenantId);
      const currencies = await this.listCurrencies(client, tenantId);
      const caps = await this.planCaps(client, tenantId);
      return this.toAdminDto(row, locales, currencies, caps);
    });
  }

  async updateSettings(
    tenantId: string,
    input: LocalizationSettingsUpdate,
  ): Promise<TenantLocalizationSettings> {
    return this.db.withTenant(tenantId, async (client) => {
      const current = await this.loadOrCreate(client, tenantId);
      const currentLocales = await this.listLocales(client, tenantId);
      const currentCurrencies = await this.listCurrencies(client, tenantId);
      const caps = await this.planCaps(client, tenantId);

      const defaultLocale = normalizeLocale(
        input.defaultLocale ?? current.default_locale,
      );
      const defaultCurrency = normalizeCurrency(
        input.defaultCurrency ?? current.default_currency,
      );
      assertInCatalog(defaultLocale, defaultCurrency);

      const multiLanguage =
        input.multiLanguage !== undefined
          ? Boolean(input.multiLanguage)
          : current.multi_language;
      const multiCurrency =
        input.multiCurrency !== undefined
          ? Boolean(input.multiCurrency)
          : current.multi_currency;

      let enabledLocales = (
        input.enabledLocales !== undefined
          ? input.enabledLocales.map(normalizeLocale)
          : currentLocales
      ).filter((v, i, arr) => arr.indexOf(v) === i);

      let enabledCurrencies = (
        input.enabledCurrencies !== undefined
          ? input.enabledCurrencies.map(normalizeCurrency)
          : currentCurrencies
      ).filter((v, i, arr) => arr.indexOf(v) === i);

      for (const loc of enabledLocales) {
        if (!(AVAILABLE_LOCALES as readonly string[]).includes(loc)) {
          throw new BadRequestException(
            `Locale ${loc} is not in the platform catalog`,
          );
        }
      }
      for (const cur of enabledCurrencies) {
        if (!(AVAILABLE_CURRENCIES as readonly string[]).includes(cur)) {
          throw new BadRequestException(
            `Currency ${cur} is not in the platform catalog`,
          );
        }
      }

      // Defaults must always be enabled
      if (!enabledLocales.includes(defaultLocale)) {
        enabledLocales = [defaultLocale, ...enabledLocales];
      }
      if (!enabledCurrencies.includes(defaultCurrency)) {
        enabledCurrencies = [defaultCurrency, ...enabledCurrencies];
      }

      // When multi is off, only the default stays enabled
      if (!multiLanguage) {
        enabledLocales = [defaultLocale];
      }
      if (!multiCurrency) {
        enabledCurrencies = [defaultCurrency];
      }

      if (enabledLocales.length > caps.maxLocales) {
        throw new ForbiddenException({
          error: 'upgrade_required',
          entitlement: 'max_locales',
          limit: caps.maxLocales,
          message: `Plan allows at most ${caps.maxLocales} locales`,
        });
      }
      if (enabledCurrencies.length > caps.maxCurrencies) {
        throw new ForbiddenException({
          error: 'upgrade_required',
          entitlement: 'max_currencies',
          limit: caps.maxCurrencies,
          message: `Plan allows at most ${caps.maxCurrencies} currencies`,
        });
      }

      const fxRounding =
        input.fxRounding !== undefined
          ? String(input.fxRounding)
          : current.fx_rounding;
      if (!['half_up', 'half_even', 'floor', 'ceil'].includes(fxRounding)) {
        throw new BadRequestException(`Invalid fxRounding: ${fxRounding}`);
      }

      const fxDisclaimer =
        input.fxDisclaimer !== undefined
          ? input.fxDisclaimer === null
            ? null
            : String(input.fxDisclaimer).trim() || null
          : current.fx_disclaimer;

      const updated = await client.query<SettingsRow>(
        `UPDATE tenant_settings
         SET default_locale = $2,
             default_currency = $3,
             multi_language = $4,
             multi_currency = $5,
             fx_rounding = $6,
             fx_disclaimer = $7,
             updated_at = now()
         WHERE tenant_id = $1
         RETURNING *`,
        [
          tenantId,
          defaultLocale,
          defaultCurrency,
          multiLanguage,
          multiCurrency,
          fxRounding,
          fxDisclaimer,
        ],
      );
      const row = updated.rows[0];
      if (!row) throw new NotFoundException('Localization settings not found');

      await client.query(`DELETE FROM tenant_locales WHERE tenant_id = $1`, [
        tenantId,
      ]);
      for (const loc of enabledLocales) {
        await client.query(
          `INSERT INTO tenant_locales (tenant_id, locale, enabled)
           VALUES ($1, $2, true)`,
          [tenantId, loc],
        );
      }

      await client.query(`DELETE FROM tenant_currencies WHERE tenant_id = $1`, [
        tenantId,
      ]);
      for (const cur of enabledCurrencies) {
        await client.query(
          `INSERT INTO tenant_currencies (tenant_id, currency, enabled)
           VALUES ($1, $2, true)`,
          [tenantId, cur],
        );
      }

      return this.toAdminDto(row, enabledLocales, enabledCurrencies, caps);
    });
  }

  async getStorefrontConfig(
    tenantId: string,
  ): Promise<StorefrontLocalization> {
    const settings = await this.getSettings(tenantId);
    return {
      defaultLocale: settings.defaultLocale,
      defaultCurrency: settings.defaultCurrency,
      multiLanguage: settings.multiLanguage,
      multiCurrency: settings.multiCurrency,
      locales: settings.multiLanguage
        ? settings.enabledLocales
        : [settings.defaultLocale],
      currencies: settings.multiCurrency
        ? settings.enabledCurrencies
        : [settings.defaultCurrency],
      fxDisclaimer: settings.multiCurrency ? settings.fxDisclaimer : null,
    };
  }

  /**
   * Resolve cart locale + currencies from tenant settings.
   * MVP: charge currency is always the store default; display may differ.
   */
  async resolveCartPrefs(
    tenantId: string,
    opts?: { locale?: string; currency?: string },
  ): Promise<{
    locale: string;
    chargeCurrency: string;
    displayCurrency: string;
  }> {
    const config = await this.getStorefrontConfig(tenantId);
    let locale = config.defaultLocale;
    if (opts?.locale) {
      const normalized = normalizeLocale(opts.locale);
      if (config.locales.includes(normalized)) {
        locale = normalized;
      }
    }

    const chargeCurrency = config.defaultCurrency;
    let displayCurrency = chargeCurrency;
    if (opts?.currency) {
      const normalized = normalizeCurrency(opts.currency);
      if (config.currencies.includes(normalized)) {
        displayCurrency = normalized;
      }
    }

    return { locale, chargeCurrency, displayCurrency };
  }

  private async loadOrCreate(
    client: TenantClient,
    tenantId: string,
  ): Promise<SettingsRow> {
    const existing = await client.query<SettingsRow>(
      `SELECT * FROM tenant_settings WHERE tenant_id = $1`,
      [tenantId],
    );
    if (existing.rows[0]) return existing.rows[0];

    const inserted = await client.query<SettingsRow>(
      `INSERT INTO tenant_settings (tenant_id)
       VALUES ($1)
       ON CONFLICT (tenant_id) DO UPDATE SET updated_at = tenant_settings.updated_at
       RETURNING *`,
      [tenantId],
    );
    const row = inserted.rows[0];
    if (!row) throw new NotFoundException('Could not create localization settings');

    await client.query(
      `INSERT INTO tenant_locales (tenant_id, locale, enabled)
       VALUES ($1, $2, true)
       ON CONFLICT DO NOTHING`,
      [tenantId, row.default_locale],
    );
    await client.query(
      `INSERT INTO tenant_currencies (tenant_id, currency, enabled)
       VALUES ($1, $2, true)
       ON CONFLICT DO NOTHING`,
      [tenantId, row.default_currency],
    );

    return row;
  }

  private async listLocales(
    client: TenantClient,
    tenantId: string,
  ): Promise<string[]> {
    const res = await client.query<{ locale: string }>(
      `SELECT locale FROM tenant_locales
       WHERE tenant_id = $1 AND enabled = true
       ORDER BY locale`,
      [tenantId],
    );
    return res.rows.map((r) => r.locale);
  }

  private async listCurrencies(
    client: TenantClient,
    tenantId: string,
  ): Promise<string[]> {
    const res = await client.query<{ currency: string }>(
      `SELECT currency FROM tenant_currencies
       WHERE tenant_id = $1 AND enabled = true
       ORDER BY currency`,
      [tenantId],
    );
    return res.rows.map((r) => r.currency);
  }

  private async planCaps(
    client: TenantClient,
    tenantId: string,
  ): Promise<{ maxLocales: number; maxCurrencies: number }> {
    const res = await client.query<{ key: string; value: string }>(
      `SELECT pe.key, pe.value
       FROM tenants t
       JOIN plan_entitlements pe ON pe.plan_id = t.plan_id
       WHERE t.id = $1 AND pe.key IN ('max_locales', 'max_currencies')`,
      [tenantId],
    );
    let maxLocales = 1;
    let maxCurrencies = 1;
    for (const row of res.rows) {
      const n = Number.parseInt(row.value, 10);
      if (!Number.isFinite(n) || n < 1) continue;
      if (row.key === 'max_locales') maxLocales = n;
      if (row.key === 'max_currencies') maxCurrencies = n;
    }
    return { maxLocales, maxCurrencies };
  }

  private toAdminDto(
    row: SettingsRow,
    locales: string[],
    currencies: string[],
    caps: { maxLocales: number; maxCurrencies: number },
  ): TenantLocalizationSettings {
    const enabledLocales = locales.length
      ? locales
      : [row.default_locale];
    const enabledCurrencies = currencies.length
      ? currencies
      : [row.default_currency];
    return {
      defaultLocale: row.default_locale,
      defaultCurrency: row.default_currency,
      multiLanguage: row.multi_language,
      multiCurrency: row.multi_currency,
      enabledLocales,
      enabledCurrencies,
      availableLocales: [...AVAILABLE_LOCALES],
      availableCurrencies: [...AVAILABLE_CURRENCIES],
      maxLocales: caps.maxLocales,
      maxCurrencies: caps.maxCurrencies,
      fxRounding: row.fx_rounding,
      fxDisclaimer: row.fx_disclaimer,
      updatedAt: asIso(row.updated_at),
    };
  }
}
