/** Thin typed client for FastAPI compute (Phase 0 stub) */

export type SdkComputeOptions = {
  baseUrl: string;
};

export type AddressValidateRequest = {
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  country: string;
};

export type AddressValidateResponse = {
  valid: boolean;
  warnings: string[];
  normalized: AddressValidateRequest;
};

export type ShippingRatesRequest = {
  to: AddressValidateRequest;
  weightGrams?: number;
};

export type ShippingRate = {
  id: string;
  carrier: string;
  service: string;
  amountMinor: number;
  currency: string;
};

export class ComputeClient {
  constructor(private readonly opts: SdkComputeOptions) {}

  async health(): Promise<{ status: string }> {
    const res = await fetch(`${this.opts.baseUrl}/health`);
    if (!res.ok) throw new Error(`health failed: ${res.status}`);
    return res.json() as Promise<{ status: string }>;
  }

  async validateAddress(body: AddressValidateRequest): Promise<AddressValidateResponse> {
    const res = await fetch(`${this.opts.baseUrl}/v1/address/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`address validate failed: ${res.status}`);
    return res.json() as Promise<AddressValidateResponse>;
  }

  async shippingRates(body: ShippingRatesRequest): Promise<{ rates: ShippingRate[] }> {
    const res = await fetch(`${this.opts.baseUrl}/v1/shipping/rates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`shipping rates failed: ${res.status}`);
    return res.json() as Promise<{ rates: ShippingRate[] }>;
  }
}

export function createComputeClient(opts: SdkComputeOptions): ComputeClient {
  return new ComputeClient(opts);
}
