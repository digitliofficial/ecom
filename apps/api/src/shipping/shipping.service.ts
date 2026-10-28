import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../db/database.service';

export type ShippingMethodDto = {
  id: string;
  name: string;
  priceAmountMinor: number;
  currency: string;
  codCompatible: boolean;
  enabled: boolean;
  sortOrder: number;
  adapter: string;
  createdAt: string;
  updatedAt: string;
};

export type StorefrontShippingMethod = {
  id: string;
  name: string;
  priceAmountMinor: number;
  currency: string;
  codCompatible: boolean;
  adapter: string;
};

export type ShippingMethodCreate = {
  name: string;
  priceAmountMinor: number;
  currency?: string;
  codCompatible?: boolean;
  enabled?: boolean;
  sortOrder?: number;
  adapter?: string;
};

export type ShippingMethodUpdate = {
  name?: string;
  priceAmountMinor?: number;
  currency?: string;
  codCompatible?: boolean;
  enabled?: boolean;
  sortOrder?: number;
  adapter?: string;
};

type MethodRow = {
  id: string;
  name: string;
  price_amount_minor: string | number;
  currency: string;
  cod_compatible: boolean;
  enabled: boolean;
  sort_order: number;
  adapter: string;
  created_at: Date | string;
  updated_at: Date | string;
};

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function asMinor(value: string | number): number {
  return typeof value === 'string' ? Number(value) : value;
}

function trimRequired(value: string | undefined, field: string): string {
  const t = value?.trim() ?? '';
  if (!t) throw new BadRequestException(`${field} is required`);
  return t;
}

@Injectable()
export class ShippingService {
  constructor(private readonly db: DatabaseService) {}

  async listAdminMethods(tenantId: string): Promise<ShippingMethodDto[]> {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<MethodRow>(
        `SELECT * FROM shipping_methods
         ORDER BY sort_order ASC, created_at ASC`,
      );
      return res.rows.map((row) => this.toDto(row));
    });
  }

  async createMethod(
    tenantId: string,
    input: ShippingMethodCreate,
  ): Promise<ShippingMethodDto> {
    const name = trimRequired(input.name, 'name');
    if (
      input.priceAmountMinor === undefined ||
      input.priceAmountMinor === null ||
      Number(input.priceAmountMinor) < 0 ||
      !Number.isFinite(Number(input.priceAmountMinor))
    ) {
      throw new BadRequestException('priceAmountMinor must be a non-negative number');
    }
    const adapter = (input.adapter?.trim() || 'manual').toLowerCase();

    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<MethodRow>(
        `INSERT INTO shipping_methods
           (tenant_id, name, price_amount_minor, currency, cod_compatible,
            enabled, sort_order, adapter)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          tenantId,
          name,
          Math.trunc(Number(input.priceAmountMinor)),
          (input.currency?.trim() || 'USD').toUpperCase(),
          input.codCompatible !== undefined ? Boolean(input.codCompatible) : true,
          input.enabled !== undefined ? Boolean(input.enabled) : true,
          input.sortOrder !== undefined ? Number(input.sortOrder) : 0,
          adapter,
        ],
      );
      return this.toDto(res.rows[0]!);
    });
  }

  async updateMethod(
    tenantId: string,
    id: string,
    input: ShippingMethodUpdate,
  ): Promise<ShippingMethodDto> {
    return this.db.withTenant(tenantId, async (client) => {
      const existing = await client.query<MethodRow>(
        `SELECT * FROM shipping_methods WHERE id = $1`,
        [id],
      );
      const current = existing.rows[0];
      if (!current) throw new NotFoundException('Shipping method not found');

      const next = {
        name:
          input.name !== undefined
            ? trimRequired(input.name, 'name')
            : current.name,
        priceAmountMinor:
          input.priceAmountMinor !== undefined
            ? Math.trunc(Number(input.priceAmountMinor))
            : asMinor(current.price_amount_minor),
        currency:
          input.currency !== undefined
            ? (input.currency.trim() || current.currency).toUpperCase()
            : current.currency,
        codCompatible:
          input.codCompatible !== undefined
            ? Boolean(input.codCompatible)
            : current.cod_compatible,
        enabled:
          input.enabled !== undefined
            ? Boolean(input.enabled)
            : current.enabled,
        sortOrder:
          input.sortOrder !== undefined
            ? Number(input.sortOrder)
            : current.sort_order,
        adapter:
          input.adapter !== undefined
            ? (input.adapter.trim() || current.adapter).toLowerCase()
            : current.adapter,
      };

      if (!Number.isFinite(next.priceAmountMinor) || next.priceAmountMinor < 0) {
        throw new BadRequestException(
          'priceAmountMinor must be a non-negative number',
        );
      }

      const res = await client.query<MethodRow>(
        `UPDATE shipping_methods
         SET name = $2,
             price_amount_minor = $3,
             currency = $4,
             cod_compatible = $5,
             enabled = $6,
             sort_order = $7,
             adapter = $8,
             updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [
          id,
          next.name,
          next.priceAmountMinor,
          next.currency,
          next.codCompatible,
          next.enabled,
          next.sortOrder,
          next.adapter,
        ],
      );
      return this.toDto(res.rows[0]!);
    });
  }

  async listStorefrontMethods(
    tenantId: string,
    opts?: { paymentMethod?: string },
  ): Promise<StorefrontShippingMethod[]> {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<MethodRow>(
        `SELECT * FROM shipping_methods
         WHERE enabled = true
         ORDER BY sort_order ASC, created_at ASC`,
      );
      let rows = res.rows;
      if (opts?.paymentMethod === 'cod') {
        rows = rows.filter((r) => r.cod_compatible);
      }
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        priceAmountMinor: asMinor(row.price_amount_minor),
        currency: row.currency,
        codCompatible: row.cod_compatible,
        adapter: row.adapter,
      }));
    });
  }

  async assertMethodForCheckout(
    tenantId: string,
    methodId: string,
    paymentMethod: string,
  ): Promise<ShippingMethodDto> {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<MethodRow>(
        `SELECT * FROM shipping_methods WHERE id = $1`,
        [methodId],
      );
      const row = res.rows[0];
      if (!row || !row.enabled) {
        throw new BadRequestException('Shipping method is not available');
      }
      if (paymentMethod === 'cod' && !row.cod_compatible) {
        throw new BadRequestException(
          'Selected shipping method is not compatible with cash on delivery',
        );
      }
      return this.toDto(row);
    });
  }

  private toDto(row: MethodRow): ShippingMethodDto {
    return {
      id: row.id,
      name: row.name,
      priceAmountMinor: asMinor(row.price_amount_minor),
      currency: row.currency,
      codCompatible: row.cod_compatible,
      enabled: row.enabled,
      sortOrder: row.sort_order,
      adapter: row.adapter,
      createdAt: asIso(row.created_at),
      updatedAt: asIso(row.updated_at),
    };
  }
}
