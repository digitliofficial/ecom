/**
 * CourierPort — FastAPI-owned rate/book/track/label surface.
 * Nest configures which adapters a tenant enables and stores selected rates /
 * tracking on orders + shipments. TypeScript package mirrors the port for
 * shared types and unit stubs; runtime adapters live in apps/compute.
 *
 * Extension (Pakistan / local couriers):
 *   Implement CourierPort as e.g. LocalPkTcsAdapter | LocalPkLeopardsAdapter
 *   and register under adapter key `local_pk_<carrier>` in shipping_methods.adapter
 *   and FastAPI `app/couriers/` registry. No Nest checkout rewrite required —
 *   quoteRates / createShipment / track stay the same.
 */

export type Address = {
  name?: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  country: string;
};

export type ShipmentQuoteRequest = {
  tenantId: string;
  from?: Address;
  to: Address;
  weightGrams?: number;
  /** When set, only quote this configured method / service */
  methodId?: string;
  currency?: string;
};

export type Rate = {
  id: string;
  carrier: string;
  service: string;
  amountMinor: number;
  currency: string;
  estimatedDays?: number;
  /** CourierPort adapter that produced this rate */
  adapter: 'manual' | 'aggregator_stub' | string;
  /** Optional link back to Nest shipping_methods.id */
  shippingMethodId?: string;
};

export type CreateShipmentRequest = {
  tenantId: string;
  rateId: string;
  orderId?: string;
  to: Address;
  from?: Address;
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

export interface CourierPort {
  quoteRates(shipment: ShipmentQuoteRequest): Promise<Rate[]>;
  createShipment(req: CreateShipmentRequest): Promise<LabelResult>;
  track(trackingNumber: string): Promise<TrackingEvent[]>;
  parseWebhook?(signature: string, body: string | Uint8Array): Promise<TrackingEvent>;
}

/** Merchant-configured flat-rate (no live carrier API). */
export class ManualAdapter implements CourierPort {
  constructor(
    private readonly methods: Array<{
      id: string;
      name: string;
      priceAmountMinor: number;
      currency: string;
    }> = [
      {
        id: 'manual_flat',
        name: 'flat_rate',
        priceAmountMinor: 0,
        currency: 'USD',
      },
    ],
  ) {}

  async quoteRates(shipment: ShipmentQuoteRequest): Promise<Rate[]> {
    const currency = shipment.currency ?? 'USD';
    return this.methods
      .filter((m) => !shipment.methodId || m.id === shipment.methodId)
      .map((m) => ({
        id: `manual:${m.id}`,
        carrier: 'manual',
        service: m.name,
        amountMinor: m.priceAmountMinor,
        currency: m.currency || currency,
        adapter: 'manual' as const,
        shippingMethodId: m.id,
      }));
  }

  async createShipment(req: CreateShipmentRequest): Promise<LabelResult> {
    const suffix = req.orderId?.slice(0, 8) ?? Date.now().toString(36);
    return {
      trackingNumber: `MANUAL-${suffix.toUpperCase()}`,
      carrier: 'manual',
      adapter: 'manual',
    };
  }

  async track(trackingNumber: string): Promise<TrackingEvent[]> {
    return [
      {
        status: 'label_created',
        description: `Manual shipment ${trackingNumber}`,
        occurredAt: new Date().toISOString(),
      },
    ];
  }
}

/**
 * Stub stand-in for EasyPost / Shippo-style aggregators.
 * Returns a fixed demo rate; swap for a real SDK later without changing callers.
 */
export class AggregatorStubAdapter implements CourierPort {
  readonly name = 'aggregator_stub';

  async quoteRates(shipment: ShipmentQuoteRequest): Promise<Rate[]> {
    const currency = shipment.currency ?? 'USD';
    return [
      {
        id: 'aggregator_stub:standard',
        carrier: 'aggregator_stub',
        service: 'standard',
        amountMinor: 800,
        currency,
        estimatedDays: 5,
        adapter: 'aggregator_stub',
      },
      {
        id: 'aggregator_stub:express',
        carrier: 'aggregator_stub',
        service: 'express',
        amountMinor: 1800,
        currency,
        estimatedDays: 2,
        adapter: 'aggregator_stub',
      },
    ];
  }

  async createShipment(req: CreateShipmentRequest): Promise<LabelResult> {
    const suffix = req.orderId?.slice(0, 8) ?? Date.now().toString(36);
    return {
      trackingNumber: `AGG-${suffix.toUpperCase()}`,
      labelUrl: `https://example.invalid/labels/${suffix}`,
      carrier: 'aggregator_stub',
      adapter: 'aggregator_stub',
    };
  }

  async track(trackingNumber: string): Promise<TrackingEvent[]> {
    return [
      {
        status: 'in_transit',
        description: `Aggregator stub tracking for ${trackingNumber}`,
        occurredAt: new Date().toISOString(),
        providerEventId: `stub_${trackingNumber}`,
      },
    ];
  }
}

/**
 * Placeholder for Pakistan local courier APIs (TCS, Leopards, M&P, Trax, …).
 * Implement quoteRates / createShipment / track against the carrier HTTP API,
 * then register in FastAPI `couriers.registry` under `local_pk_<slug>`.
 */
export class PakistanLocalCourierAdapterStub implements CourierPort {
  constructor(private readonly carrierSlug: string = 'local_pk') {}

  async quoteRates(_shipment: ShipmentQuoteRequest): Promise<Rate[]> {
    throw new Error(
      `${this.carrierSlug}: not implemented — plug carrier API here (Phase 2)`,
    );
  }

  async createShipment(_req: CreateShipmentRequest): Promise<LabelResult> {
    throw new Error(
      `${this.carrierSlug}: not implemented — plug carrier booking here (Phase 2)`,
    );
  }

  async track(_trackingNumber: string): Promise<TrackingEvent[]> {
    throw new Error(
      `${this.carrierSlug}: not implemented — plug carrier tracking here (Phase 2)`,
    );
  }
}

export function courierAdapterFor(
  key: string,
  manualMethods?: ConstructorParameters<typeof ManualAdapter>[0],
): CourierPort {
  switch (key) {
    case 'manual':
      return new ManualAdapter(manualMethods);
    case 'aggregator_stub':
      return new AggregatorStubAdapter();
    default:
      if (key.startsWith('local_pk')) {
        return new PakistanLocalCourierAdapterStub(key);
      }
      return new ManualAdapter(manualMethods);
  }
}
