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

export type ShippingMethodQuoteInput = {
  id: string;
  name: string;
  priceAmountMinor: number;
  currency?: string;
};

export type ShippingRatesRequest = {
  to: AddressValidateRequest;
  from?: AddressValidateRequest;
  weightGrams?: number;
  methodId?: string;
  currency?: string;
  adapter?: string;
  tenantId?: string;
  methods?: ShippingMethodQuoteInput[];
};

export type ShippingRate = {
  id: string;
  carrier: string;
  service: string;
  amountMinor: number;
  currency: string;
  estimatedDays?: number;
  adapter?: string;
  shippingMethodId?: string;
};

export type CreateShipmentRequest = {
  rateId: string;
  orderId?: string;
  to: AddressValidateRequest;
  from?: AddressValidateRequest;
  adapter?: string;
  tenantId?: string;
};

export type LabelResult = {
  trackingNumber: string;
  labelUrl?: string;
  carrier?: string;
  adapter: string;
};

export type TrackingEvent = {
  status: string;
  description?: string;
  occurredAt?: string;
  providerEventId?: string;
};

export class ComputeClient {
  private readonly opts: SdkComputeOptions;

  constructor(opts: SdkComputeOptions) {
    this.opts = opts;
  }

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

  async createShipment(body: CreateShipmentRequest): Promise<LabelResult> {
    const res = await fetch(`${this.opts.baseUrl}/v1/shipping/shipments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`create shipment failed: ${res.status}`);
    return res.json() as Promise<LabelResult>;
  }

  async track(
    trackingNumber: string,
    adapter = 'manual',
  ): Promise<{ events: TrackingEvent[] }> {
    const res = await fetch(
      `${this.opts.baseUrl}/v1/shipping/track/${encodeURIComponent(trackingNumber)}?adapter=${encodeURIComponent(adapter)}`,
      { headers: { Accept: 'application/json' } },
    );
    if (!res.ok) throw new Error(`track failed: ${res.status}`);
    return res.json() as Promise<{ events: TrackingEvent[] }>;
  }
}

export function createComputeClient(opts: SdkComputeOptions): ComputeClient {
  return new ComputeClient(opts);
}
