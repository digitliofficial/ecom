import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../db/database.service';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export type ReviewDto = {
  id: string;
  productId: string;
  customerId: string;
  rating: number;
  title: string | null;
  body: string;
  locale: string;
  status: ReviewStatus;
  verifiedPurchase: boolean;
  authorDisplayName: string | null;
  createdAt: string;
  moderatedAt: string | null;
};

export type ProductRatingSummary = {
  productId: string;
  ratingAvg: number;
  ratingCount: number;
};

@Injectable()
export class ReviewsService {
  constructor(private readonly db: DatabaseService) {}

  async listApproved(
    tenantId: string,
    productId: string,
  ): Promise<ReviewDto[]> {
    return this.db.withTenant(tenantId, async (client) => {
      await this.requireProduct(client, productId);
      return this.queryReviews(client, {
        productId,
        status: 'approved',
      });
    });
  }

  async create(
    tenantId: string,
    customerId: string,
    productId: string,
    input: {
      rating: number;
      title?: string;
      body: string;
      locale?: string;
    },
  ): Promise<ReviewDto> {
    const rating = Number(input.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('rating must be an integer from 1 to 5');
    }
    const body = input.body?.trim();
    if (!body) throw new BadRequestException('body is required');
    const title = input.title?.trim() || null;
    const locale = (input.locale?.trim() || 'en').slice(0, 16);

    return this.db.withTenant(tenantId, async (client) => {
      await this.requireProduct(client, productId);
      const verified = await this.hasVerifiedPurchase(
        client,
        customerId,
        productId,
      );

      const inserted = await client.query<{
        id: string;
        product_id: string;
        customer_id: string;
        rating: number;
        title: string | null;
        body: string;
        locale: string;
        status: ReviewStatus;
        verified_purchase: boolean;
        created_at: Date;
        moderated_at: Date | null;
      }>(
        `INSERT INTO product_reviews
           (tenant_id, product_id, customer_id, rating, title, body, locale,
            status, verified_purchase)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
         RETURNING id, product_id, customer_id, rating, title, body, locale,
                   status, verified_purchase, created_at, moderated_at`,
        [
          tenantId,
          productId,
          customerId,
          rating,
          title,
          body,
          locale,
          verified,
        ],
      );

      const reviews = await this.queryReviews(client, {
        reviewId: inserted.rows[0]!.id,
      });
      return reviews[0]!;
    });
  }

  async listAdmin(
    tenantId: string,
    status?: ReviewStatus,
  ): Promise<ReviewDto[]> {
    return this.db.withTenant(tenantId, async (client) => {
      return this.queryReviews(client, { status });
    });
  }

  async moderate(
    tenantId: string,
    reviewId: string,
    status: ReviewStatus,
  ): Promise<ReviewDto> {
    if (status !== 'approved' && status !== 'rejected' && status !== 'pending') {
      throw new BadRequestException(
        'status must be pending, approved, or rejected',
      );
    }
    return this.db.withTenant(tenantId, async (client) => {
      const updated = await client.query<{ product_id: string }>(
        `UPDATE product_reviews
         SET status = $1, moderated_at = now(), updated_at = now()
         WHERE id = $2
         RETURNING product_id`,
        [status, reviewId],
      );
      if (!updated.rows[0]) throw new NotFoundException('Review not found');
      await this.recomputeProductRating(client, updated.rows[0].product_id);
      const reviews = await this.queryReviews(client, { reviewId });
      return reviews[0]!;
    });
  }

  async getProductRating(
    tenantId: string,
    productId: string,
  ): Promise<ProductRatingSummary> {
    return this.db.withTenant(tenantId, async (client) => {
      const row = await client.query<{
        id: string;
        rating_avg: string;
        rating_count: number;
      }>(
        `SELECT id, rating_avg::text, rating_count
         FROM products WHERE id = $1`,
        [productId],
      );
      if (!row.rows[0]) throw new NotFoundException('Product not found');
      return {
        productId: row.rows[0].id,
        ratingAvg: Number(row.rows[0].rating_avg),
        ratingCount: Number(row.rows[0].rating_count),
      };
    });
  }

  private async requireProduct(client: PoolClient, productId: string) {
    const found = await client.query<{ id: string }>(
      `SELECT id FROM products WHERE id = $1`,
      [productId],
    );
    if (!found.rows[0]) throw new NotFoundException('Product not found');
  }

  private async hasVerifiedPurchase(
    client: PoolClient,
    customerId: string,
    productId: string,
  ): Promise<boolean> {
    const result = await client.query<{ ok: number }>(
      `SELECT 1 AS ok
       FROM orders o
       JOIN order_lines ol ON ol.order_id = o.id
       JOIN product_variants pv ON pv.id = ol.variant_id
       WHERE o.customer_id = $1
         AND pv.product_id = $2
         AND o.status IN ('placed', 'fulfilled', 'partially_fulfilled', 'shipped')
       LIMIT 1`,
      [customerId, productId],
    );
    return Boolean(result.rows[0]);
  }

  private async recomputeProductRating(
    client: PoolClient,
    productId: string,
  ): Promise<void> {
    await client.query(
      `UPDATE products p
       SET rating_avg = COALESCE(agg.avg_rating, 0),
           rating_count = COALESCE(agg.cnt, 0)
       FROM (
         SELECT ROUND(AVG(rating)::numeric, 2) AS avg_rating,
                COUNT(*)::int AS cnt
         FROM product_reviews
         WHERE product_id = $1 AND status = 'approved'
       ) agg
       WHERE p.id = $1`,
      [productId],
    );
  }

  private async queryReviews(
    client: PoolClient,
    opts: {
      productId?: string;
      reviewId?: string;
      status?: ReviewStatus;
    },
  ): Promise<ReviewDto[]> {
    const params: unknown[] = [];
    const clauses: string[] = [];
    if (opts.productId) {
      params.push(opts.productId);
      clauses.push(`r.product_id = $${params.length}`);
    }
    if (opts.reviewId) {
      params.push(opts.reviewId);
      clauses.push(`r.id = $${params.length}`);
    }
    if (opts.status) {
      params.push(opts.status);
      clauses.push(`r.status = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const rows = await client.query<{
      id: string;
      product_id: string;
      customer_id: string;
      rating: number;
      title: string | null;
      body: string;
      locale: string;
      status: ReviewStatus;
      verified_purchase: boolean;
      display_name: string | null;
      created_at: Date;
      moderated_at: Date | null;
    }>(
      `SELECT r.id, r.product_id, r.customer_id, r.rating, r.title, r.body,
              r.locale, r.status, r.verified_purchase, c.display_name,
              r.created_at, r.moderated_at
       FROM product_reviews r
       JOIN customers c ON c.id = r.customer_id
       ${where}
       ORDER BY r.created_at DESC`,
      params,
    );

    return rows.rows.map((r) => ({
      id: r.id,
      productId: r.product_id,
      customerId: r.customer_id,
      rating: Number(r.rating),
      title: r.title,
      body: r.body,
      locale: r.locale,
      status: r.status,
      verifiedPurchase: r.verified_purchase,
      authorDisplayName: r.display_name,
      createdAt: r.created_at.toISOString(),
      moderatedAt: r.moderated_at ? r.moderated_at.toISOString() : null,
    }));
  }
}
