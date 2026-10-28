/** CourierPort types + ManualAdapter stub (consumed conceptually by FastAPI) */

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
  from: Address;
  to: Address;
  weightGrams?: number;
};

export type Rate = {
  id: string;
  carrier: string;
  service: string;
  amountMinor: number;
  currency: string;
  estimatedDays?: number;
};

export type LabelResult = {
  trackingNumber: string;
  labelUrl?: string;
};

export type TrackingEvent = {
  status: string;
  description?: string;
  occurredAt?: string;
};

export interface CourierPort {
  quoteRates(shipment: ShipmentQuoteRequest): Promise<Rate[]>;
  createShipment?(rateId: string): Promise<LabelResult>;
  track?(trackingNumber: string): Promise<TrackingEvent[]>;
}

export class ManualAdapter implements CourierPort {
  async quoteRates(_shipment: ShipmentQuoteRequest): Promise<Rate[]> {
    return [
      {
        id: 'manual_flat',
        carrier: 'manual',
        service: 'flat_rate',
        amountMinor: 0,
        currency: 'USD',
        estimatedDays: undefined,
      },
    ];
  }
}
