import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  resolveThemeTokens,
  themePacks,
  type ThemeTokenOverrides,
  type ThemeTokens,
} from '@ecom/themes';
import { DatabaseService } from '../db/database.service';

export type PolicyKind =
  | 'privacy'
  | 'refund'
  | 'terms'
  | 'shipping'
  | 'cookie';

export type MenuHandle = 'header' | 'footer';

export type MenuItemDto = {
  id: string;
  label: string;
  href: string;
  position: number;
  locale: string | null;
};

export type MenuDto = {
  handle: MenuHandle;
  title: string;
  items: MenuItemDto[];
  updatedAt: string;
};

export type SeoSettingsDto = {
  locale: string;
  siteTitle: string;
  metaDescription: string;
  ogImageUrl: string | null;
  updatedAt: string;
};

export type ThemeSettingsDto = {
  themePackId: string;
  tokenOverrides: ThemeTokenOverrides;
  resolved: ThemeTokens;
  updatedAt: string;
};

export type PolicyDto = {
  kind: PolicyKind;
  locale: string;
  title: string;
  body: string;
  updatedAt: string;
};

export type CmsBootstrap = {
  locale: string;
  theme: ThemeSettingsDto;
  seo: SeoSettingsDto;
  menus: { header: MenuDto; footer: MenuDto };
  policies: Array<Pick<PolicyDto, 'kind' | 'title' | 'locale'>>;
};

export type ThemeSettingsUpdate = {
  themePackId?: string;
  tokenOverrides?: ThemeTokenOverrides | null;
};

export type SeoSettingsUpdate = {
  locale?: string;
  siteTitle?: string;
  metaDescription?: string;
  ogImageUrl?: string | null;
};

export type MenuItemInput = {
  label: string;
  href: string;
  position?: number;
  locale?: string | null;
};

export type MenuUpdateInput = {
  title?: string;
  items: MenuItemInput[];
};

export type PolicyUpdateInput = {
  locale?: string;
  title?: string;
  body?: string;
};

const POLICY_KINDS: PolicyKind[] = [
  'privacy',
  'refund',
  'terms',
  'shipping',
  'cookie',
];

const MENU_HANDLES: MenuHandle[] = ['header', 'footer'];

const DEFAULT_POLICY_COPY: Record<
  PolicyKind,
  { title: string; body: string }
> = {
  privacy: {
    title: 'Privacy policy',
    body: 'This store collects only what is needed to fulfill orders. Contact the merchant for DSAR requests.',
  },
  refund: {
    title: 'Refund policy',
    body: 'Refunds are handled by the merchant for unused items within 14 days of delivery.',
  },
  terms: {
    title: 'Terms of service',
    body: 'By placing an order you agree to provide accurate contact and shipping details.',
  },
  shipping: {
    title: 'Shipping policy',
    body: 'Shipping timelines are merchant-configured. Tracking is sent when the order is marked shipped.',
  },
  cookie: {
    title: 'Cookie policy',
    body: 'Essential cookies power guest cart and account sessions. Analytics cookies require consent when enabled.',
  },
};

type ThemeRow = {
  tenant_id: string;
  theme_pack_id: string;
  token_overrides: ThemeTokenOverrides | string;
  updated_at: Date | string;
};

type SeoRow = {
  tenant_id: string;
  locale: string;
  site_title: string;
  meta_description: string;
  og_image_url: string | null;
  updated_at: Date | string;
};

type MenuRow = {
  id: string;
  tenant_id: string;
  handle: MenuHandle;
  title: string;
  updated_at: Date | string;
};

type MenuItemRow = {
  id: string;
  tenant_id: string;
  menu_id: string;
  label: string;
  href: string;
  position: number;
  locale: string | null;
};

type PolicyRow = {
  id: string;
  tenant_id: string;
  kind: PolicyKind;
  locale: string;
  title: string;
  body: string;
  updated_at: Date | string;
};

type DbClient = {
  query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
};

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function parseOverrides(
  raw: ThemeTokenOverrides | string | null | undefined,
): ThemeTokenOverrides {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as ThemeTokenOverrides;
    } catch {
      return {};
    }
  }
  return raw;
}

function trimOrEmpty(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function trimOrNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const t = value.trim();
  return t.length ? t : null;
}

function assertPolicyKind(kind: string): PolicyKind {
  if (!POLICY_KINDS.includes(kind as PolicyKind)) {
    throw new BadRequestException(
      `invalid policy kind; expected one of ${POLICY_KINDS.join(', ')}`,
    );
  }
  return kind as PolicyKind;
}

function assertMenuHandle(handle: string): MenuHandle {
  if (!MENU_HANDLES.includes(handle as MenuHandle)) {
    throw new BadRequestException(
      `invalid menu handle; expected one of ${MENU_HANDLES.join(', ')}`,
    );
  }
  return handle as MenuHandle;
}

@Injectable()
export class CmsService {
  constructor(private readonly db: DatabaseService) {}

  listThemePacks(): ThemeTokens[] {
    return themePacks;
  }

  async getBootstrap(
    tenantId: string,
    locale = 'en',
  ): Promise<CmsBootstrap> {
    return this.db.withTenant(tenantId, async (client) => {
      const theme = await this.loadTheme(client, tenantId);
      const seo = await this.loadSeo(client, tenantId, locale);
      const header = await this.loadMenu(client, tenantId, 'header', locale);
      const footer = await this.loadMenu(client, tenantId, 'footer', locale);
      const policies = await this.listPolicySummaries(client, tenantId, locale);
      return {
        locale: seo.locale,
        theme,
        seo,
        menus: { header, footer },
        policies,
      };
    });
  }

  async getTheme(tenantId: string): Promise<ThemeSettingsDto> {
    return this.db.withTenant(tenantId, (client) =>
      this.loadTheme(client, tenantId),
    );
  }

  async updateTheme(
    tenantId: string,
    input: ThemeSettingsUpdate,
  ): Promise<ThemeSettingsDto> {
    return this.db.withTenant(tenantId, async (client) => {
      const current = await this.ensureTheme(client, tenantId);
      const packId =
        input.themePackId !== undefined
          ? input.themePackId.trim()
          : current.theme_pack_id;

      if (!themePacks.some((p) => p.id === packId)) {
        throw new BadRequestException(
          `unknown theme pack "${packId}"; available: ${themePacks.map((p) => p.id).join(', ')}`,
        );
      }

      const overrides =
        input.tokenOverrides !== undefined
          ? (input.tokenOverrides ?? {})
          : parseOverrides(current.token_overrides);

      const res = await client.query<ThemeRow>(
        `UPDATE tenant_theme_settings
         SET theme_pack_id = $2,
             token_overrides = $3::jsonb,
             updated_at = now()
         WHERE tenant_id = $1
         RETURNING *`,
        [tenantId, packId, JSON.stringify(overrides)],
      );
      const row = res.rows[0];
      if (!row) throw new NotFoundException('Theme settings not found');
      return this.themeDto(row);
    });
  }

  async getSeo(tenantId: string, locale = 'en'): Promise<SeoSettingsDto> {
    return this.db.withTenant(tenantId, (client) =>
      this.loadSeo(client, tenantId, locale),
    );
  }

  async updateSeo(
    tenantId: string,
    input: SeoSettingsUpdate,
  ): Promise<SeoSettingsDto> {
    return this.db.withTenant(tenantId, async (client) => {
      const locale = (input.locale ?? 'en').trim() || 'en';
      const current = await this.ensureSeo(client, tenantId, locale);

      const next = {
        siteTitle:
          input.siteTitle !== undefined
            ? trimOrEmpty(input.siteTitle)
            : current.site_title,
        metaDescription:
          input.metaDescription !== undefined
            ? trimOrEmpty(input.metaDescription)
            : current.meta_description,
        ogImageUrl:
          input.ogImageUrl !== undefined
            ? trimOrNull(input.ogImageUrl)
            : current.og_image_url,
      };

      if (!next.siteTitle) {
        throw new BadRequestException('siteTitle is required');
      }

      const res = await client.query<SeoRow>(
        `UPDATE tenant_seo_settings
         SET site_title = $3,
             meta_description = $4,
             og_image_url = $5,
             updated_at = now()
         WHERE tenant_id = $1 AND locale = $2
         RETURNING *`,
        [
          tenantId,
          locale,
          next.siteTitle,
          next.metaDescription,
          next.ogImageUrl,
        ],
      );
      const row = res.rows[0];
      if (!row) throw new NotFoundException('SEO settings not found');
      return this.seoDto(row);
    });
  }

  async getMenu(
    tenantId: string,
    handle: string,
    locale = 'en',
  ): Promise<MenuDto> {
    const h = assertMenuHandle(handle);
    return this.db.withTenant(tenantId, (client) =>
      this.loadMenu(client, tenantId, h, locale),
    );
  }

  async replaceMenu(
    tenantId: string,
    handle: string,
    input: MenuUpdateInput,
  ): Promise<MenuDto> {
    const h = assertMenuHandle(handle);
    if (!Array.isArray(input.items)) {
      throw new BadRequestException('items array is required');
    }

    return this.db.withTenant(tenantId, async (client) => {
      const menu = await this.ensureMenu(client, tenantId, h);
      const title =
        input.title !== undefined ? trimOrEmpty(input.title) : menu.title;

      await client.query(
        `UPDATE menus SET title = $2, updated_at = now() WHERE id = $1`,
        [menu.id, title || h],
      );

      await client.query(`DELETE FROM menu_items WHERE menu_id = $1`, [
        menu.id,
      ]);

      let position = 0;
      for (const item of input.items) {
        const label = trimOrEmpty(item.label);
        const href = trimOrEmpty(item.href);
        if (!label || !href) {
          throw new BadRequestException(
            'each menu item requires non-empty label and href',
          );
        }
        const pos =
          typeof item.position === 'number' && Number.isFinite(item.position)
            ? item.position
            : position;
        await client.query(
          `INSERT INTO menu_items (tenant_id, menu_id, label, href, position, locale)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            tenantId,
            menu.id,
            label,
            href,
            pos,
            item.locale === undefined ? null : trimOrNull(item.locale),
          ],
        );
        position += 1;
      }

      return this.loadMenu(client, tenantId, h, 'en');
    });
  }

  async listPolicies(
    tenantId: string,
    locale = 'en',
  ): Promise<PolicyDto[]> {
    return this.db.withTenant(tenantId, async (client) => {
      const out: PolicyDto[] = [];
      for (const kind of POLICY_KINDS) {
        out.push(await this.loadPolicy(client, tenantId, kind, locale));
      }
      return out;
    });
  }

  async getPolicy(
    tenantId: string,
    kind: string,
    locale = 'en',
  ): Promise<PolicyDto> {
    const k = assertPolicyKind(kind);
    return this.db.withTenant(tenantId, (client) =>
      this.loadPolicy(client, tenantId, k, locale),
    );
  }

  async updatePolicy(
    tenantId: string,
    kind: string,
    input: PolicyUpdateInput,
  ): Promise<PolicyDto> {
    const k = assertPolicyKind(kind);
    return this.db.withTenant(tenantId, async (client) => {
      const locale = (input.locale ?? 'en').trim() || 'en';
      const current = await this.ensurePolicy(client, tenantId, k, locale);

      const next = {
        title:
          input.title !== undefined
            ? trimOrEmpty(input.title)
            : current.title,
        body:
          input.body !== undefined ? String(input.body ?? '') : current.body,
      };

      if (!next.title) {
        throw new BadRequestException('title is required');
      }

      const res = await client.query<PolicyRow>(
        `UPDATE policies
         SET title = $4, body = $5, updated_at = now()
         WHERE tenant_id = $1 AND kind = $2 AND locale = $3
         RETURNING *`,
        [tenantId, k, locale, next.title, next.body],
      );
      const row = res.rows[0];
      if (!row) throw new NotFoundException('Policy not found');
      return this.policyDto(row);
    });
  }

  private themeDto(row: ThemeRow): ThemeSettingsDto {
    const overrides = parseOverrides(row.token_overrides);
    return {
      themePackId: row.theme_pack_id,
      tokenOverrides: overrides,
      resolved: resolveThemeTokens(row.theme_pack_id, overrides),
      updatedAt: asIso(row.updated_at),
    };
  }

  private seoDto(row: SeoRow): SeoSettingsDto {
    return {
      locale: row.locale,
      siteTitle: row.site_title,
      metaDescription: row.meta_description,
      ogImageUrl: row.og_image_url,
      updatedAt: asIso(row.updated_at),
    };
  }

  private policyDto(row: PolicyRow): PolicyDto {
    return {
      kind: row.kind,
      locale: row.locale,
      title: row.title,
      body: row.body,
      updatedAt: asIso(row.updated_at),
    };
  }

  private async loadTheme(
    client: DbClient,
    tenantId: string,
  ): Promise<ThemeSettingsDto> {
    const row = await this.ensureTheme(client, tenantId);
    return this.themeDto(row);
  }

  private async ensureTheme(
    client: DbClient,
    tenantId: string,
  ): Promise<ThemeRow> {
    const existing = await client.query<ThemeRow>(
      `SELECT * FROM tenant_theme_settings WHERE tenant_id = $1`,
      [tenantId],
    );
    if (existing.rows[0]) return existing.rows[0];

    const inserted = await client.query<ThemeRow>(
      `INSERT INTO tenant_theme_settings (tenant_id)
       VALUES ($1)
       ON CONFLICT (tenant_id) DO UPDATE SET updated_at = tenant_theme_settings.updated_at
       RETURNING *`,
      [tenantId],
    );
    const row = inserted.rows[0];
    if (!row) throw new NotFoundException('Could not create theme settings');
    return row;
  }

  private async loadSeo(
    client: DbClient,
    tenantId: string,
    locale: string,
  ): Promise<SeoSettingsDto> {
    const row = await this.ensureSeo(client, tenantId, locale);
    return this.seoDto(row);
  }

  private async ensureSeo(
    client: DbClient,
    tenantId: string,
    locale: string,
  ): Promise<SeoRow> {
    const existing = await client.query<SeoRow>(
      `SELECT * FROM tenant_seo_settings WHERE tenant_id = $1 AND locale = $2`,
      [tenantId, locale],
    );
    if (existing.rows[0]) return existing.rows[0];

    // Fall back to en if requesting another locale
    if (locale !== 'en') {
      const en = await client.query<SeoRow>(
        `SELECT * FROM tenant_seo_settings WHERE tenant_id = $1 AND locale = 'en'`,
        [tenantId],
      );
      if (en.rows[0]) return en.rows[0];
    }

    const inserted = await client.query<SeoRow>(
      `INSERT INTO tenant_seo_settings (tenant_id, locale, site_title, meta_description)
       VALUES ($1, $2, 'Store', '')
       ON CONFLICT (tenant_id, locale) DO UPDATE SET updated_at = tenant_seo_settings.updated_at
       RETURNING *`,
      [tenantId, locale],
    );
    const row = inserted.rows[0];
    if (!row) throw new NotFoundException('Could not create SEO settings');
    return row;
  }

  private async ensureMenu(
    client: DbClient,
    tenantId: string,
    handle: MenuHandle,
  ): Promise<MenuRow> {
    const existing = await client.query<MenuRow>(
      `SELECT * FROM menus WHERE tenant_id = $1 AND handle = $2`,
      [tenantId, handle],
    );
    if (existing.rows[0]) return existing.rows[0];

    const inserted = await client.query<MenuRow>(
      `INSERT INTO menus (tenant_id, handle, title)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, handle) DO UPDATE SET updated_at = menus.updated_at
       RETURNING *`,
      [tenantId, handle, handle === 'header' ? 'Header' : 'Footer'],
    );
    const row = inserted.rows[0];
    if (!row) throw new NotFoundException('Could not create menu');
    return row;
  }

  private async loadMenu(
    client: DbClient,
    tenantId: string,
    handle: MenuHandle,
    locale: string,
  ): Promise<MenuDto> {
    const menu = await this.ensureMenu(client, tenantId, handle);
    const items = await client.query<MenuItemRow>(
      `SELECT * FROM menu_items
       WHERE menu_id = $1
         AND (locale IS NULL OR locale = $2)
       ORDER BY position ASC, created_at ASC`,
      [menu.id, locale],
    );
    return {
      handle,
      title: menu.title,
      updatedAt: asIso(menu.updated_at),
      items: items.rows.map((row) => ({
        id: row.id,
        label: row.label,
        href: row.href,
        position: row.position,
        locale: row.locale,
      })),
    };
  }

  private async listPolicySummaries(
    client: DbClient,
    tenantId: string,
    locale: string,
  ): Promise<Array<Pick<PolicyDto, 'kind' | 'title' | 'locale'>>> {
    const out: Array<Pick<PolicyDto, 'kind' | 'title' | 'locale'>> = [];
    for (const kind of POLICY_KINDS) {
      const p = await this.loadPolicy(client, tenantId, kind, locale);
      out.push({ kind: p.kind, title: p.title, locale: p.locale });
    }
    return out;
  }

  private async loadPolicy(
    client: DbClient,
    tenantId: string,
    kind: PolicyKind,
    locale: string,
  ): Promise<PolicyDto> {
    const row = await this.ensurePolicy(client, tenantId, kind, locale);
    return this.policyDto(row);
  }

  private async ensurePolicy(
    client: DbClient,
    tenantId: string,
    kind: PolicyKind,
    locale: string,
  ): Promise<PolicyRow> {
    const existing = await client.query<PolicyRow>(
      `SELECT * FROM policies WHERE tenant_id = $1 AND kind = $2 AND locale = $3`,
      [tenantId, kind, locale],
    );
    if (existing.rows[0]) return existing.rows[0];

    if (locale !== 'en') {
      const en = await client.query<PolicyRow>(
        `SELECT * FROM policies WHERE tenant_id = $1 AND kind = $2 AND locale = 'en'`,
        [tenantId, kind],
      );
      if (en.rows[0]) return en.rows[0];
    }

    const defaults = DEFAULT_POLICY_COPY[kind];
    const inserted = await client.query<PolicyRow>(
      `INSERT INTO policies (tenant_id, kind, locale, title, body)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, kind, locale) DO UPDATE SET updated_at = policies.updated_at
       RETURNING *`,
      [tenantId, kind, locale, defaults.title, defaults.body],
    );
    const row = inserted.rows[0];
    if (!row) throw new NotFoundException('Could not create policy');
    return row;
  }
}
