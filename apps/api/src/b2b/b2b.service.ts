import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../db/database.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

export type PriceListItemDto = {
  id: string;
  variantId: string;
  unitAmountMinor: number;
  currency: string;
  sku?: string;
  variantTitle?: string;
};

export type PriceListDto = {
  id: string;
  name: string;
  currency: string;
  items: PriceListItemDto[];
};

export type CustomerGroupDto = {
  id: string;
  name: string;
  priceListId: string | null;
  memberCount: number;
  members: { customerId: string; email: string; displayName: string | null }[];
};

@Injectable()
export class B2bService {
  constructor(
    private readonly db: DatabaseService,
    private readonly entitlements: EntitlementsService,
  ) {}

  private async requireB2b(tenantId: string) {
    await this.entitlements.require(
      tenantId,
      'feature_b2b',
      'B2B customer groups require a Growth+ plan entitlement (feature_b2b)',
    );
  }

  async listPriceLists(tenantId: string): Promise<PriceListDto[]> {
    await this.requireB2b(tenantId);
    return this.db.withTenant(tenantId, async (client) => {
      const lists = await client.query<{
        id: string;
        name: string;
        currency: string;
      }>(
        `SELECT id, name, currency FROM price_lists ORDER BY created_at`,
      );
      const result: PriceListDto[] = [];
      for (const list of lists.rows) {
        result.push(await this.mapPriceList(client, list));
      }
      return result;
    });
  }

  async createPriceList(
    tenantId: string,
    input: {
      name: string;
      currency?: string;
      items?: { variantId: string; unitAmountMinor: number; currency?: string }[];
    },
  ): Promise<PriceListDto> {
    await this.requireB2b(tenantId);
    const name = input.name?.trim();
    if (!name) throw new BadRequestException('name is required');
    const currency = (input.currency?.trim() || 'USD').toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new BadRequestException('currency must be a 3-letter ISO code');
    }

    return this.db.withTenant(tenantId, async (client) => {
      let listId: string;
      try {
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO price_lists (tenant_id, name, currency)
           VALUES ($1, $2, $3) RETURNING id`,
          [tenantId, name, currency],
        );
        listId = inserted.rows[0]!.id;
      } catch (err) {
        this.rethrowUnique(err, 'price list name already exists');
        throw err;
      }

      for (const item of input.items ?? []) {
        await this.upsertItem(client, tenantId, listId, item, currency);
      }

      const list = await client.query<{
        id: string;
        name: string;
        currency: string;
      }>(`SELECT id, name, currency FROM price_lists WHERE id = $1`, [listId]);
      return this.mapPriceList(client, list.rows[0]!);
    });
  }

  async updatePriceList(
    tenantId: string,
    priceListId: string,
    input: {
      name?: string;
      currency?: string;
      items?: { variantId: string; unitAmountMinor: number; currency?: string }[];
    },
  ): Promise<PriceListDto> {
    await this.requireB2b(tenantId);
    await this.entitlements.require(tenantId, 'feature_b2b');

    return this.db.withTenant(tenantId, async (client) => {
      const existing = await client.query<{
        id: string;
        name: string;
        currency: string;
      }>(`SELECT id, name, currency FROM price_lists WHERE id = $1`, [
        priceListId,
      ]);
      if (!existing.rows[0]) throw new NotFoundException('Price list not found');

      const sets: string[] = [];
      const params: unknown[] = [];
      let i = 1;
      if (input.name !== undefined) {
        const name = input.name.trim();
        if (!name) throw new BadRequestException('name cannot be empty');
        sets.push(`name = $${i++}`);
        params.push(name);
      }
      if (input.currency !== undefined) {
        const currency = input.currency.trim().toUpperCase();
        if (!/^[A-Z]{3}$/.test(currency)) {
          throw new BadRequestException('currency must be a 3-letter ISO code');
        }
        sets.push(`currency = $${i++}`);
        params.push(currency);
      }
      if (sets.length) {
        params.push(priceListId);
        try {
          await client.query(
            `UPDATE price_lists SET ${sets.join(', ')} WHERE id = $${i}`,
            params,
          );
        } catch (err) {
          this.rethrowUnique(err, 'price list name already exists');
          throw err;
        }
      }

      if (input.items) {
        await client.query(
          `DELETE FROM price_list_items WHERE price_list_id = $1`,
          [priceListId],
        );
        const listCurrency =
          input.currency?.trim().toUpperCase() || existing.rows[0].currency;
        for (const item of input.items) {
          await this.upsertItem(
            client,
            tenantId,
            priceListId,
            item,
            listCurrency,
          );
        }
      }

      const list = await client.query<{
        id: string;
        name: string;
        currency: string;
      }>(`SELECT id, name, currency FROM price_lists WHERE id = $1`, [
        priceListId,
      ]);
      return this.mapPriceList(client, list.rows[0]!);
    });
  }

  async listCustomerGroups(tenantId: string): Promise<CustomerGroupDto[]> {
    await this.requireB2b(tenantId);
    return this.db.withTenant(tenantId, async (client) => {
      const groups = await client.query<{
        id: string;
        name: string;
        price_list_id: string | null;
      }>(
        `SELECT id, name, price_list_id FROM customer_groups ORDER BY created_at`,
      );
      const result: CustomerGroupDto[] = [];
      for (const g of groups.rows) {
        result.push(await this.mapGroup(client, g));
      }
      return result;
    });
  }

  async createCustomerGroup(
    tenantId: string,
    input: {
      name: string;
      priceListId?: string | null;
      customerIds?: string[];
    },
  ): Promise<CustomerGroupDto> {
    await this.requireB2b(tenantId);
    const name = input.name?.trim();
    if (!name) throw new BadRequestException('name is required');

    return this.db.withTenant(tenantId, async (client) => {
      if (input.priceListId) {
        await this.requirePriceList(client, input.priceListId);
      }
      let groupId: string;
      try {
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO customer_groups (tenant_id, name, price_list_id)
           VALUES ($1, $2, $3) RETURNING id`,
          [tenantId, name, input.priceListId ?? null],
        );
        groupId = inserted.rows[0]!.id;
      } catch (err) {
        this.rethrowUnique(err, 'customer group name already exists');
        throw err;
      }

      for (const customerId of input.customerIds ?? []) {
        await this.addMember(client, tenantId, groupId, customerId);
      }

      const group = await client.query<{
        id: string;
        name: string;
        price_list_id: string | null;
      }>(`SELECT id, name, price_list_id FROM customer_groups WHERE id = $1`, [
        groupId,
      ]);
      return this.mapGroup(client, group.rows[0]!);
    });
  }

  async updateCustomerGroup(
    tenantId: string,
    groupId: string,
    input: {
      name?: string;
      priceListId?: string | null;
      customerIds?: string[];
    },
  ): Promise<CustomerGroupDto> {
    await this.requireB2b(tenantId);

    return this.db.withTenant(tenantId, async (client) => {
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM customer_groups WHERE id = $1`,
        [groupId],
      );
      if (!existing.rows[0]) {
        throw new NotFoundException('Customer group not found');
      }

      if (input.priceListId) {
        await this.requirePriceList(client, input.priceListId);
      }

      const sets: string[] = [];
      const params: unknown[] = [];
      let i = 1;
      if (input.name !== undefined) {
        const name = input.name.trim();
        if (!name) throw new BadRequestException('name cannot be empty');
        sets.push(`name = $${i++}`);
        params.push(name);
      }
      if (input.priceListId !== undefined) {
        sets.push(`price_list_id = $${i++}`);
        params.push(input.priceListId);
      }
      if (sets.length) {
        params.push(groupId);
        try {
          await client.query(
            `UPDATE customer_groups SET ${sets.join(', ')} WHERE id = $${i}`,
            params,
          );
        } catch (err) {
          this.rethrowUnique(err, 'customer group name already exists');
          throw err;
        }
      }

      if (input.customerIds) {
        await client.query(
          `DELETE FROM customer_group_members WHERE group_id = $1`,
          [groupId],
        );
        for (const customerId of input.customerIds) {
          await this.addMember(client, tenantId, groupId, customerId);
        }
      }

      const group = await client.query<{
        id: string;
        name: string;
        price_list_id: string | null;
      }>(`SELECT id, name, price_list_id FROM customer_groups WHERE id = $1`, [
        groupId,
      ]);
      return this.mapGroup(client, group.rows[0]!);
    });
  }

  async addGroupMember(
    tenantId: string,
    groupId: string,
    customerId: string,
  ): Promise<CustomerGroupDto> {
    await this.requireB2b(tenantId);
    return this.db.withTenant(tenantId, async (client) => {
      const existing = await client.query<{
        id: string;
        name: string;
        price_list_id: string | null;
      }>(`SELECT id, name, price_list_id FROM customer_groups WHERE id = $1`, [
        groupId,
      ]);
      if (!existing.rows[0]) {
        throw new NotFoundException('Customer group not found');
      }
      await this.addMember(client, tenantId, groupId, customerId);
      return this.mapGroup(client, existing.rows[0]);
    });
  }

  async removeGroupMember(
    tenantId: string,
    groupId: string,
    customerId: string,
  ): Promise<CustomerGroupDto> {
    await this.requireB2b(tenantId);
    return this.db.withTenant(tenantId, async (client) => {
      const existing = await client.query<{
        id: string;
        name: string;
        price_list_id: string | null;
      }>(`SELECT id, name, price_list_id FROM customer_groups WHERE id = $1`, [
        groupId,
      ]);
      if (!existing.rows[0]) {
        throw new NotFoundException('Customer group not found');
      }
      await client.query(
        `DELETE FROM customer_group_members
         WHERE group_id = $1 AND customer_id = $2`,
        [groupId, customerId],
      );
      return this.mapGroup(client, existing.rows[0]);
    });
  }

  private async mapPriceList(
    client: import('pg').PoolClient,
    list: { id: string; name: string; currency: string },
  ): Promise<PriceListDto> {
    const items = await client.query<{
      id: string;
      variant_id: string;
      unit_amount_minor: string;
      currency: string;
      sku: string | null;
      variant_title: string | null;
    }>(
      `SELECT pli.id, pli.variant_id, pli.unit_amount_minor::text, pli.currency,
              pv.sku, pv.title AS variant_title
       FROM price_list_items pli
       LEFT JOIN product_variants pv ON pv.id = pli.variant_id
       WHERE pli.price_list_id = $1
       ORDER BY pli.created_at`,
      [list.id],
    );
    return {
      id: list.id,
      name: list.name,
      currency: list.currency,
      items: items.rows.map((i) => ({
        id: i.id,
        variantId: i.variant_id,
        unitAmountMinor: Number(i.unit_amount_minor),
        currency: i.currency,
        sku: i.sku ?? undefined,
        variantTitle: i.variant_title ?? undefined,
      })),
    };
  }

  private async mapGroup(
    client: import('pg').PoolClient,
    group: { id: string; name: string; price_list_id: string | null },
  ): Promise<CustomerGroupDto> {
    const members = await client.query<{
      customer_id: string;
      email: string;
      display_name: string | null;
    }>(
      `SELECT cgm.customer_id, c.email, c.display_name
       FROM customer_group_members cgm
       JOIN customers c ON c.id = cgm.customer_id
       WHERE cgm.group_id = $1
       ORDER BY cgm.created_at`,
      [group.id],
    );
    return {
      id: group.id,
      name: group.name,
      priceListId: group.price_list_id,
      memberCount: members.rows.length,
      members: members.rows.map((m) => ({
        customerId: m.customer_id,
        email: m.email,
        displayName: m.display_name,
      })),
    };
  }

  private async requirePriceList(
    client: import('pg').PoolClient,
    priceListId: string,
  ) {
    const found = await client.query<{ id: string }>(
      `SELECT id FROM price_lists WHERE id = $1`,
      [priceListId],
    );
    if (!found.rows[0]) throw new NotFoundException('Price list not found');
  }

  private async addMember(
    client: import('pg').PoolClient,
    tenantId: string,
    groupId: string,
    customerId: string,
  ) {
    const customer = await client.query<{ id: string }>(
      `SELECT id FROM customers WHERE id = $1`,
      [customerId],
    );
    if (!customer.rows[0]) throw new NotFoundException('Customer not found');
    try {
      await client.query(
        `INSERT INTO customer_group_members (tenant_id, group_id, customer_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (group_id, customer_id) DO NOTHING`,
        [tenantId, groupId, customerId],
      );
    } catch (err) {
      this.rethrowUnique(err, 'customer already in group');
      throw err;
    }
  }

  private async upsertItem(
    client: import('pg').PoolClient,
    tenantId: string,
    priceListId: string,
    item: { variantId: string; unitAmountMinor: number; currency?: string },
    defaultCurrency: string,
  ) {
    const variantId = item.variantId?.trim();
    if (!variantId) throw new BadRequestException('variantId is required');
    const amount = Number(item.unitAmountMinor);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException('unitAmountMinor must be >= 0');
    }
    const currency = (item.currency?.trim() || defaultCurrency).toUpperCase();
    const variant = await client.query<{ id: string }>(
      `SELECT id FROM product_variants WHERE id = $1`,
      [variantId],
    );
    if (!variant.rows[0]) throw new NotFoundException('Variant not found');
    await client.query(
      `INSERT INTO price_list_items
         (tenant_id, price_list_id, variant_id, unit_amount_minor, currency)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (price_list_id, variant_id) DO UPDATE
       SET unit_amount_minor = EXCLUDED.unit_amount_minor,
           currency = EXCLUDED.currency`,
      [tenantId, priceListId, variantId, Math.trunc(amount), currency],
    );
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
