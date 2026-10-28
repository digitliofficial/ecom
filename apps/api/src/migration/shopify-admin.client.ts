import { Injectable } from '@nestjs/common';
import type {
  ShopifyCustomer,
  ShopifyOrder,
  ShopifyProduct,
  ShopifyRedirect,
} from './types';

export type ShopifyCredentials = {
  shopDomain: string;
  accessToken: string;
};

export type ShopifyFetch = (
  url: string,
  init?: RequestInit,
) => Promise<Response>;

/**
 * Thin Shopify Admin REST client (2024-10).
 * Rate-limit aware: honors Retry-After; pages via Link header.
 */
@Injectable()
export class ShopifyAdminClient {
  private fetchImpl: ShopifyFetch = fetch;

  /** Test hook — swap fetch without Nest DI optional params. */
  setFetch(fetchImpl: ShopifyFetch): void {
    this.fetchImpl = fetchImpl;
  }

  async listProducts(creds: ShopifyCredentials): Promise<ShopifyProduct[]> {
    return this.paginate<ShopifyProduct>(creds, '/products.json', 'products');
  }

  async listCustomers(creds: ShopifyCredentials): Promise<ShopifyCustomer[]> {
    return this.paginate<ShopifyCustomer>(
      creds,
      '/customers.json',
      'customers',
    );
  }

  async listOrders(creds: ShopifyCredentials): Promise<ShopifyOrder[]> {
    return this.paginate<ShopifyOrder>(
      creds,
      '/orders.json?status=any',
      'orders',
    );
  }

  async listRedirects(creds: ShopifyCredentials): Promise<ShopifyRedirect[]> {
    return this.paginate<ShopifyRedirect>(
      creds,
      '/redirects.json',
      'redirects',
    );
  }

  private async paginate<T>(
    creds: ShopifyCredentials,
    path: string,
    key: string,
  ): Promise<T[]> {
    const out: T[] = [];
    let nextUrl: string | null = this.adminUrl(creds.shopDomain, path);

    while (nextUrl) {
      const res = await this.request(creds.accessToken, nextUrl);
      const body = (await res.json()) as Record<string, T[]>;
      const page = body[key] ?? [];
      out.push(...page);
      nextUrl = this.nextLink(res.headers.get('link'));
    }

    return out;
  }

  private async request(accessToken: string, url: string): Promise<Response> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await this.fetchImpl(url, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('retry-after') ?? '2');
        await sleep(Math.max(1, retryAfter) * 1000);
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Shopify Admin ${res.status}: ${text.slice(0, 400)}`);
      }
      return res;
    }
    throw new Error('Shopify Admin rate limit exceeded after retries');
  }

  private adminUrl(shopDomain: string, path: string): string {
    const host = shopDomain
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .toLowerCase();
    const normalized = path.startsWith('/') ? path : `/${path}`;
    const withPrefix = normalized.startsWith('/admin/')
      ? normalized
      : `/admin/api/2024-10${normalized}`;
    return `https://${host}${withPrefix}`;
  }

  private nextLink(linkHeader: string | null): string | null {
    if (!linkHeader) return null;
    const match = linkHeader
      .split(',')
      .map((p) => p.trim())
      .find((p) => p.includes('rel="next"'));
    if (!match) return null;
    const url = match.match(/<([^>]+)>/);
    return url?.[1] ?? null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
