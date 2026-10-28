import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../db/database.service';

export type DiscountType = 'percentage' | 'fixed';

export type DiscountDto = {
  id: string;
  code: string;
  title: string;
  type: DiscountType;
  value: number;
  currency: string;
  minSubtotalMinor: number;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  usageCount: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DiscountCreateInput = {
  code: string;
  title: string;
  type: DiscountType;
  value: number;
  currency?: string;
  minSubtotalMinor?: number;
  startsAt?: string | null;
  endsAt?: string | null;
  usageLimit?: number | null;
  active?: boolean;
};

export type DiscountUpdateInput = {
  code?: string;
  title?: string;
  type?: DiscountType;
  value?: number;
  currency?: string;
  minSubtotalMinor?: number;
  startsAt?: string | null;
  endsAt?: string | null;
  usageLimit?: number | null;
  active?: boolean;
};

export type AppliedDiscount = {
  id: string;
  code: string;
  type: DiscountType;
  value: number;
  discountAmountMinor: number;
};

function asIso(value: Date | string | null): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function asIsoRequired(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

@Injectable()
export class DiscountsService {
  constructor(private readonly db: DatabaseService) {}

  async listAdmin(tenantId: string): Promise<DiscountDto[]> {
    return this.db.withTenant(tenantId, async (client) => {
      return this.loadMany(client);
    });
  }

  async getAdmin(tenantId: string, id: string): Promise<DiscountDto> {
    return this.db.withTenant(tenantId, async (client) => {
      const discount = await this.loadOne(client, { id });
      if (!discount) throw new NotFoundException('Discount not found');
      return discount;
    });
  }

  async create(
    tenantId: string,
    input: DiscountCreateInput,
  ): Promise<DiscountDto> {
    const normalized = this.normalizeCreate(input);
    return this.db.withTenant(tenantId, async (client) => {
      try {
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO discounts
             (tenant_id, code, title, type, value, currency,
              min_subtotal_minor, starts_at, ends_at, usage_limit, active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id`,
          [
            tenantId,
            normalized.code,
            normalized.title,
            normalized.type,
            normalized.value,
            normalized.currency,
            normalized.minSubtotalMinor,
            normalized.startsAt,
            normalized.endsAt,
            normalized.usageLimit,
            normalized.active,
          ],
        );
        const discount = await this.loadOne(client, {
          id: inserted.rows[0]!.id,
        });
        return discount!;
      } catch (err) {
        this.rethrowUnique(err, 'discount code already exists');
        throw err;
      }
    });
  }

  async update(
    tenantId: string,
    id: string,
    input: DiscountUpdateInput,
  ): Promise<DiscountDto> {
    return this.db.withTenant(tenantId, async (client) => {
      const existing = await this.loadOne(client, { id });
      if (!existing) throw new NotFoundException('Discount not found');

      const next = this.mergeUpdate(existing, input);
      try {
        await client.query(
          `UPDATE discounts
           SET code = $1,
               title = $2,
               type = $3,
               value = $4,
               currency = $5,
               min_subtotal_minor = $6,
               starts_at = $7,
               ends_at = $8,
               usage_limit = $9,
               active = $10,
               updated_at = now()
           WHERE id = $11`,
          [
            next.code,
            next.title,
            next.type,
            next.value,
            next.currency,
            next.minSubtotalMinor,
            next.startsAt,
            next.endsAt,
            next.usageLimit,
            next.active,
            id,
          ],
        );
      } catch (err) {
        this.rethrowUnique(err, 'discount code already exists');
        throw err;
      }
      return (await this.loadOne(client, { id }))!;
    });
  }

  async remove(tenantId: string, id: string): Promise<void> {
    await this.db.withTenant(tenantId, async (client) => {
      const deleted = await client.query<{ id: string }>(
        `DELETE FROM discounts WHERE id = $1 RETURNING id`,
        [id],
      );
      if (!deleted.rows[0]) throw new NotFoundException('Discount not found');
    });
  }

  /**
   * Validate and compute discount for a checkout subtotal.
   * Must run inside an existing withTenant transaction when incrementing usage.
   */
  async applyCoupon(
    client: PoolClient,
    code: string,
    subtotalMinor: number,
    currency: string,
  ): Promise<AppliedDiscount> {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      throw new BadRequestException('discount code is required');
    }

    const row = await client.query<{
      id: string;
      code: string;
      type: DiscountType;
      value: string;
      currency: string;
      min_subtotal_minor: string | number;
      starts_at: Date | string | null;
      ends_at: Date | string | null;
      usage_limit: number | null;
      usage_count: number;
      active: boolean;
    }>(
      `SELECT id, code, type, value::text, currency, min_subtotal_minor,
              starts_at, ends_at, usage_limit, usage_count, active
       FROM discounts
       WHERE upper(code) = $1
       FOR UPDATE`,
      [normalized],
    );

    const discount = row.rows[0];
    if (!discount || !discount.active) {
      throw new BadRequestException('Invalid or inactive discount code');
    }

    const now = Date.now();
    if (discount.starts_at && new Date(discount.starts_at).getTime() > now) {
      throw new BadRequestException('Discount code is not active yet');
    }
    if (discount.ends_at && new Date(discount.ends_at).getTime() < now) {
      throw new BadRequestException('Discount code has expired');
    }
    if (
      discount.usage_limit != null &&
      discount.usage_count >= discount.usage_limit
    ) {
      throw new BadRequestException('Discount code usage limit reached');
    }

    const minSubtotal = Number(discount.min_subtotal_minor);
    if (subtotalMinor < minSubtotal) {
      throw new BadRequestException(
        `Order subtotal must be at least ${minSubtotal} minor units`,
      );
    }

    if (
      discount.type === 'fixed' &&
      discount.currency.toUpperCase() !== currency.toUpperCase()
    ) {
      throw new BadRequestException(
        `Discount currency ${discount.currency} does not match cart ${currency}`,
      );
    }

    const value = Number(discount.value);
    let discountAmountMinor: number;
    if (discount.type === 'percentage') {
      discountAmountMinor = Math.floor((subtotalMinor * value) / 100);
    } else {
      discountAmountMinor = Math.trunc(value);
    }
    discountAmountMinor = Math.max(
      0,
      Math.min(discountAmountMinor, subtotalMinor),
    );

    await client.query(
      `UPDATE discounts
       SET usage_count = usage_count + 1, updated_at = now()
       WHERE id = $1`,
      [discount.id],
    );

    return {
      id: discount.id,
      code: discount.code,
      type: discount.type,
      value,
      discountAmountMinor,
    };
  }

  private async loadMany(client: PoolClient): Promise<DiscountDto[]> {
    const res = await client.query<{
      id: string;
      code: string;
      title: string;
      type: DiscountType;
      value: string;
      currency: string;
      min_subtotal_minor: string | number;
      starts_at: Date | string | null;
      ends_at: Date | string | null;
      usage_limit: number | null;
      usage_count: number;
      active: boolean;
      created_at: Date | string;
      updated_at: Date | string;
    }>(
      `SELECT id, code, title, type, value::text, currency, min_subtotal_minor,
              starts_at, ends_at, usage_limit, usage_count, active,
              created_at, updated_at
       FROM discounts
       ORDER BY created_at DESC`,
    );
    return res.rows.map((row) => this.toDto(row));
  }

  private async loadOne(
    client: PoolClient,
    opts: { id: string },
  ): Promise<DiscountDto | null> {
    const res = await client.query<{
      id: string;
      code: string;
      title: string;
      type: DiscountType;
      value: string;
      currency: string;
      min_subtotal_minor: string | number;
      starts_at: Date | string | null;
      ends_at: Date | string | null;
      usage_limit: number | null;
      usage_count: number;
      active: boolean;
      created_at: Date | string;
      updated_at: Date | string;
    }>(
      `SELECT id, code, title, type, value::text, currency, min_subtotal_minor,
              starts_at, ends_at, usage_limit, usage_count, active,
              created_at, updated_at
       FROM discounts
       WHERE id = $1`,
      [opts.id],
    );
    const row = res.rows[0];
    return row ? this.toDto(row) : null;
  }

  private toDto(row: {
    id: string;
    code: string;
    title: string;
    type: DiscountType;
    value: string;
    currency: string;
    min_subtotal_minor: string | number;
    starts_at: Date | string | null;
    ends_at: Date | string | null;
    usage_limit: number | null;
    usage_count: number;
    active: boolean;
    created_at: Date | string;
    updated_at: Date | string;
  }): DiscountDto {
    return {
      id: row.id,
      code: row.code,
      title: row.title,
      type: row.type,
      value: Number(row.value),
      currency: row.currency,
      minSubtotalMinor: Number(row.min_subtotal_minor),
      startsAt: asIso(row.starts_at),
      endsAt: asIso(row.ends_at),
      usageLimit: row.usage_limit,
      usageCount: row.usage_count,
      active: row.active,
      createdAt: asIsoRequired(row.created_at),
      updatedAt: asIsoRequired(row.updated_at),
    };
  }

  private normalizeCreate(input: DiscountCreateInput): {
    code: string;
    title: string;
    type: DiscountType;
    value: number;
    currency: string;
    minSubtotalMinor: number;
    startsAt: string | null;
    endsAt: string | null;
    usageLimit: number | null;
    active: boolean;
  } {
    const code = input.code?.trim().toUpperCase();
    const title = input.title?.trim();
    if (!code) throw new BadRequestException('code is required');
    if (!/^[A-Z0-9_-]{2,32}$/.test(code)) {
      throw new BadRequestException(
        'code must be 2–32 chars: A–Z, 0–9, _ or -',
      );
    }
    if (!title) throw new BadRequestException('title is required');
    const type = this.normalizeType(input.type);
    const value = this.normalizeValue(type, input.value);
    const currency = (input.currency?.trim() || 'USD').toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new BadRequestException('currency must be a 3-letter ISO code');
    }
    const minSubtotalMinor = Number(input.minSubtotalMinor ?? 0);
    if (
      !Number.isFinite(minSubtotalMinor) ||
      minSubtotalMinor < 0 ||
      !Number.isInteger(minSubtotalMinor)
    ) {
      throw new BadRequestException('minSubtotalMinor must be an integer >= 0');
    }
    const usageLimit =
      input.usageLimit === undefined || input.usageLimit === null
        ? null
        : Number(input.usageLimit);
    if (
      usageLimit !== null &&
      (!Number.isFinite(usageLimit) ||
        usageLimit < 1 ||
        !Number.isInteger(usageLimit))
    ) {
      throw new BadRequestException('usageLimit must be an integer >= 1');
    }
    return {
      code,
      title,
      type,
      value,
      currency,
      minSubtotalMinor,
      startsAt: this.normalizeOptionalDate(input.startsAt),
      endsAt: this.normalizeOptionalDate(input.endsAt),
      usageLimit,
      active: input.active !== false,
    };
  }

  private mergeUpdate(
    existing: DiscountDto,
    input: DiscountUpdateInput,
  ): {
    code: string;
    title: string;
    type: DiscountType;
    value: number;
    currency: string;
    minSubtotalMinor: number;
    startsAt: string | null;
    endsAt: string | null;
    usageLimit: number | null;
    active: boolean;
  } {
    return this.normalizeCreate({
      code: input.code ?? existing.code,
      title: input.title ?? existing.title,
      type: input.type ?? existing.type,
      value: input.value ?? existing.value,
      currency: input.currency ?? existing.currency,
      minSubtotalMinor:
        input.minSubtotalMinor !== undefined
          ? input.minSubtotalMinor
          : existing.minSubtotalMinor,
      startsAt:
        input.startsAt !== undefined ? input.startsAt : existing.startsAt,
      endsAt: input.endsAt !== undefined ? input.endsAt : existing.endsAt,
      usageLimit:
        input.usageLimit !== undefined ? input.usageLimit : existing.usageLimit,
      active: input.active !== undefined ? input.active : existing.active,
    });
  }

  private normalizeType(type: string): DiscountType {
    const value = String(type ?? '')
      .trim()
      .toLowerCase();
    if (value !== 'percentage' && value !== 'fixed') {
      throw new BadRequestException('type must be percentage or fixed');
    }
    return value;
  }

  private normalizeValue(type: DiscountType, raw: number): number {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      throw new BadRequestException('value must be > 0');
    }
    if (type === 'percentage') {
      if (value > 100) {
        throw new BadRequestException('percentage value must be <= 100');
      }
      return Math.round(value * 100) / 100;
    }
    if (!Number.isInteger(value)) {
      throw new BadRequestException('fixed value must be an integer (minor units)');
    }
    return value;
  }

  private normalizeOptionalDate(value: string | null | undefined): string | null {
    if (value === undefined || value === null || value === '') return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('invalid date');
    }
    return date.toISOString();
  }

  private rethrowUnique(err: unknown, message: string): void {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === '23505'
    ) {
      throw new ConflictException(message);
    }
  }
}
