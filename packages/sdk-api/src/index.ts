/** Thin typed client for Nest API (Phase 0 stub) */

export type SdkApiOptions = {
  baseUrl: string;
  getToken?: () => string | undefined;
  getHost?: () => string | undefined;
};

export class ApiClient {
  constructor(private readonly opts: SdkApiOptions) {}

  async health(): Promise<{ status: string }> {
    const res = await fetch(`${this.opts.baseUrl}/health`);
    if (!res.ok) throw new Error(`health failed: ${res.status}`);
    return res.json() as Promise<{ status: string }>;
  }

  async get<T>(path: string): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const token = this.opts.getToken?.();
    const host = this.opts.getHost?.();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (host) headers['X-Forwarded-Host'] = host;
    const res = await fetch(`${this.opts.baseUrl}${path}`, { headers });
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
    return res.json() as Promise<T>;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    const token = this.opts.getToken?.();
    const host = this.opts.getHost?.();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (host) headers['X-Forwarded-Host'] = host;
    const res = await fetch(`${this.opts.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
    return res.json() as Promise<T>;
  }
}

export function createApiClient(opts: SdkApiOptions): ApiClient {
  return new ApiClient(opts);
}
