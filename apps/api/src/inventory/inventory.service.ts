import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../db/database.service';

export type LocationDto = {
  id: string;
  name: string;
  code: string;
  isDefault: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LocationCreateInput = {
  name: string;
  code: string;
  isDefault?: boolean;
  active?: boolean;
};

export type LocationUpdateInput = {
  name?: string;
  code?: string;
  isDefault?: boolean;
  active?: boolean;
};

export type InventoryLevelDto = {
  id: string;
  locationId: string;
  locationCode: string;
  locationName: string;
  variantId: string;
  sku: string;
  productTitle: string;
  quantity: number;
  updatedAt: string;
};

export type SetStockInput = {
  locationId: string;
  variantId: string;
  quantity: number;
};

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

@Injectable()
export class InventoryService {
  constructor(private readonly db: DatabaseService) {}

  async listLocations(tenantId: string): Promise<LocationDto[]> {
    return this.db.withTenant(tenantId, async (client) => {
      return this.loadLocations(client);
    });
  }

  async getLocation(tenantId: string, id: string): Promise<LocationDto> {
    return this.db.withTenant(tenantId, async (client) => {
      const location = await this.loadLocation(client, id);
      if (!location) throw new NotFoundException('Location not found');
      return location;
    });
  }

  async createLocation(
    tenantId: string,
    input: LocationCreateInput,
  ): Promise<LocationDto> {
    const name = input.name?.trim();
    const code = input.code?.trim().toUpperCase();
    if (!name) throw new BadRequestException('name is required');
    if (!code) throw new BadRequestException('code is required');
    if (!/^[A-Z0-9_-]{2,16}$/.test(code)) {
      throw new BadRequestException(
        'code must be 2–16 chars: A–Z, 0–9, _ or -',
      );
    }
    const isDefault = Boolean(input.isDefault);
    const active = input.active !== false;

    return this.db.withTenant(tenantId, async (client) => {
      if (isDefault) {
        await client.query(
          `UPDATE locations SET is_default = false WHERE is_default = true`,
        );
      }
      try {
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO locations
             (tenant_id, name, code, is_default, active)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [tenantId, name, code, isDefault, active],
        );
        return (await this.loadLocation(client, inserted.rows[0]!.id))!;
      } catch (err) {
        this.rethrowUnique(err, 'location code already exists');
        throw err;
      }
    });
  }

  async updateLocation(
    tenantId: string,
    id: string,
    input: LocationUpdateInput,
  ): Promise<LocationDto> {
    return this.db.withTenant(tenantId, async (client) => {
      const existing = await this.loadLocation(client, id);
      if (!existing) throw new NotFoundException('Location not found');

      const name =
        input.name !== undefined ? input.name.trim() : existing.name;
      const code =
        input.code !== undefined
          ? input.code.trim().toUpperCase()
          : existing.code;
      if (!name) throw new BadRequestException('name cannot be empty');
      if (!code) throw new BadRequestException('code cannot be empty');
      if (!/^[A-Z0-9_-]{2,16}$/.test(code)) {
        throw new BadRequestException(
          'code must be 2–16 chars: A–Z, 0–9, _ or -',
        );
      }
      const isDefault =
        input.isDefault !== undefined ? Boolean(input.isDefault) : existing.isDefault;
      const active =
        input.active !== undefined ? Boolean(input.active) : existing.active;

      if (isDefault) {
        await client.query(
          `UPDATE locations SET is_default = false WHERE is_default = true AND id <> $1`,
          [id],
        );
      }

      try {
        await client.query(
          `UPDATE locations
           SET name = $1, code = $2, is_default = $3, active = $4, updated_at = now()
           WHERE id = $5`,
          [name, code, isDefault, active, id],
        );
      } catch (err) {
        this.rethrowUnique(err, 'location code already exists');
        throw err;
      }
      return (await this.loadLocation(client, id))!;
    });
  }

  async listLevels(tenantId: string): Promise<InventoryLevelDto[]> {
    return this.db.withTenant(tenantId, async (client) => {
      const res = await client.query<{
        id: string;
        location_id: string;
        location_code: string;
        location_name: string;
        variant_id: string;
        sku: string;
        product_title: string;
        quantity: number;
        updated_at: Date | string;
      }>(
        `SELECT il.id, il.location_id, loc.code AS location_code, loc.name AS location_name,
                il.variant_id, v.sku, p.title AS product_title, il.quantity, il.updated_at
         FROM inventory_levels il
         JOIN locations loc ON loc.id = il.location_id
         JOIN product_variants v ON v.id = il.variant_id
         JOIN products p ON p.id = v.product_id
         ORDER BY loc.code, p.title, v.sku`,
      );
      return res.rows.map((row) => ({
        id: row.id,
        locationId: row.location_id,
        locationCode: row.location_code,
        locationName: row.location_name,
        variantId: row.variant_id,
        sku: row.sku,
        productTitle: row.product_title,
        quantity: row.quantity,
        updatedAt: asIso(row.updated_at),
      }));
    });
  }

  async setStock(
    tenantId: string,
    input: SetStockInput,
  ): Promise<InventoryLevelDto> {
    const quantity = Number(input.quantity);
    if (
      !Number.isFinite(quantity) ||
      quantity < 0 ||
      !Number.isInteger(quantity)
    ) {
      throw new BadRequestException('quantity must be an integer >= 0');
    }
    if (!input.locationId || !input.variantId) {
      throw new BadRequestException('locationId and variantId are required');
    }

    return this.db.withTenant(tenantId, async (client) => {
      const location = await this.loadLocation(client, input.locationId);
      if (!location) throw new NotFoundException('Location not found');

      const variant = await client.query<{ id: string }>(
        `SELECT id FROM product_variants WHERE id = $1`,
        [input.variantId],
      );
      if (!variant.rows[0]) throw new NotFoundException('Variant not found');

      const upserted = await client.query<{ id: string }>(
        `INSERT INTO inventory_levels
           (tenant_id, location_id, variant_id, quantity, updated_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (location_id, variant_id)
         DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = now()
         RETURNING id`,
        [tenantId, input.locationId, input.variantId, quantity],
      );

      await this.syncVariantAggregate(client, input.variantId);

      const level = await client.query<{
        id: string;
        location_id: string;
        location_code: string;
        location_name: string;
        variant_id: string;
        sku: string;
        product_title: string;
        quantity: number;
        updated_at: Date | string;
      }>(
        `SELECT il.id, il.location_id, loc.code AS location_code, loc.name AS location_name,
                il.variant_id, v.sku, p.title AS product_title, il.quantity, il.updated_at
         FROM inventory_levels il
         JOIN locations loc ON loc.id = il.location_id
         JOIN product_variants v ON v.id = il.variant_id
         JOIN products p ON p.id = v.product_id
         WHERE il.id = $1`,
        [upserted.rows[0]!.id],
      );
      const row = level.rows[0]!;
      return {
        id: row.id,
        locationId: row.location_id,
        locationCode: row.location_code,
        locationName: row.location_name,
        variantId: row.variant_id,
        sku: row.sku,
        productTitle: row.product_title,
        quantity: row.quantity,
        updatedAt: asIso(row.updated_at),
      };
    });
  }

  /**
   * Decrement stock across locations for order lines.
   * Prefers the default location, then other active locations by code.
   * Must run inside an existing withTenant transaction.
   */
  async decrementForOrderLines(
    client: PoolClient,
    lines: Array<{ variantId: string; quantity: number }>,
  ): Promise<void> {
    for (const line of lines) {
      let remaining = line.quantity;
      const levels = await client.query<{
        id: string;
        quantity: number;
      }>(
        `SELECT il.id, il.quantity
         FROM inventory_levels il
         JOIN locations loc ON loc.id = il.location_id
         WHERE il.variant_id = $1 AND loc.active = true AND il.quantity > 0
         ORDER BY loc.is_default DESC, loc.code ASC
         FOR UPDATE OF il`,
        [line.variantId],
      );

      const available = levels.rows.reduce((sum, row) => sum + row.quantity, 0);
      if (available < remaining) {
        // Also check aggregate column for variants without levels yet
        const variant = await client.query<{ inventory_quantity: number }>(
          `SELECT COALESCE(inventory_quantity, 0)::int AS inventory_quantity
           FROM product_variants
           WHERE id = $1
           FOR UPDATE`,
          [line.variantId],
        );
        const aggregate = variant.rows[0]?.inventory_quantity ?? 0;
        if (levels.rows.length === 0 && aggregate >= remaining) {
          await client.query(
            `UPDATE product_variants
             SET inventory_quantity = inventory_quantity - $1
             WHERE id = $2`,
            [remaining, line.variantId],
          );
          continue;
        }
        throw new BadRequestException(
          `Insufficient inventory for variant ${line.variantId}`,
        );
      }

      for (const level of levels.rows) {
        if (remaining <= 0) break;
        const take = Math.min(level.quantity, remaining);
        await client.query(
          `UPDATE inventory_levels
           SET quantity = quantity - $1, updated_at = now()
           WHERE id = $2`,
          [take, level.id],
        );
        remaining -= take;
      }

      await this.syncVariantAggregate(client, line.variantId);
    }
  }

  private async syncVariantAggregate(
    client: PoolClient,
    variantId: string,
  ): Promise<void> {
    await client.query(
      `UPDATE product_variants v
       SET inventory_quantity = COALESCE((
         SELECT SUM(il.quantity)::int
         FROM inventory_levels il
         WHERE il.variant_id = v.id
       ), 0)
       WHERE v.id = $1`,
      [variantId],
    );
  }

  private async loadLocations(client: PoolClient): Promise<LocationDto[]> {
    const res = await client.query<{
      id: string;
      name: string;
      code: string;
      is_default: boolean;
      active: boolean;
      created_at: Date | string;
      updated_at: Date | string;
    }>(
      `SELECT id, name, code, is_default, active, created_at, updated_at
       FROM locations
       ORDER BY is_default DESC, code ASC`,
    );
    return res.rows.map((row) => this.toLocation(row));
  }

  private async loadLocation(
    client: PoolClient,
    id: string,
  ): Promise<LocationDto | null> {
    const res = await client.query<{
      id: string;
      name: string;
      code: string;
      is_default: boolean;
      active: boolean;
      created_at: Date | string;
      updated_at: Date | string;
    }>(
      `SELECT id, name, code, is_default, active, created_at, updated_at
       FROM locations
       WHERE id = $1`,
      [id],
    );
    const row = res.rows[0];
    return row ? this.toLocation(row) : null;
  }

  private toLocation(row: {
    id: string;
    name: string;
    code: string;
    is_default: boolean;
    active: boolean;
    created_at: Date | string;
    updated_at: Date | string;
  }): LocationDto {
    return {
      id: row.id,
      name: row.name,
      code: row.code,
      isDefault: row.is_default,
      active: row.active,
      createdAt: asIso(row.created_at),
      updatedAt: asIso(row.updated_at),
    };
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
