/** PaymentProvider port + stubs (Phase 0) */

export type PaymentIntentInput = {
  tenantId: string;
  amountMinor: number;
  currency: string;
  orderId?: string;
  metadata?: Record<string, string>;
};

export type PaymentIntentResult = {
  id: string;
  status: 'requires_action' | 'succeeded' | 'failed' | 'not_implemented';
  clientSecret?: string;
  provider: string;
};

export type PaymentEvent = {
  id: string;
  type: string;
  provider: string;
  raw?: unknown;
};

export interface PaymentProvider {
  readonly name: string;
  createPayment(intent: PaymentIntentInput): Promise<PaymentIntentResult>;
  confirm?(intentId: string): Promise<PaymentIntentResult>;
  capture?(intentId: string): Promise<PaymentIntentResult>;
  refund?(intentId: string, amountMinor?: number): Promise<PaymentIntentResult>;
  parseWebhook?(signature: string, body: string | Uint8Array): Promise<PaymentEvent>;
}

export class NoopAdapter implements PaymentProvider {
  readonly name = 'noop';

  async createPayment(_intent: PaymentIntentInput): Promise<PaymentIntentResult> {
    return {
      id: 'noop_not_implemented',
      status: 'not_implemented',
      provider: this.name,
    };
  }
}

/** Stripe Connect stub — wire real SDK in Phase 1 */
export class StripeConnectStub implements PaymentProvider {
  readonly name = 'stripe_connect';

  async createPayment(_intent: PaymentIntentInput): Promise<PaymentIntentResult> {
    return {
      id: 'stripe_stub_not_implemented',
      status: 'not_implemented',
      provider: this.name,
    };
  }
}
