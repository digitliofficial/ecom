/** PaymentProvider port — online stubs + offline COD / bank transfer adapters */

export type OfflinePaymentMethod = 'cod' | 'bank_transfer';

export type PaymentMethodId = OfflinePaymentMethod | 'noop' | 'stripe_connect';

export type PaymentIntentInput = {
  tenantId: string;
  amountMinor: number;
  currency: string;
  orderId?: string;
  metadata?: Record<string, string>;
};

export type PaymentIntentStatus =
  | 'requires_action'
  | 'succeeded'
  | 'failed'
  | 'not_implemented'
  | 'pending_cod'
  | 'pending_transfer';

export type PaymentIntentResult = {
  id: string;
  status: PaymentIntentStatus;
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

function intentId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Cash on delivery — offline; no charge at checkout */
export class CodAdapter implements PaymentProvider {
  readonly name = 'cod';

  async createPayment(_intent: PaymentIntentInput): Promise<PaymentIntentResult> {
    return {
      id: intentId('cod'),
      status: 'pending_cod',
      provider: this.name,
    };
  }
}

/** Manual bank transfer — offline; shopper pays via IBAN/account details */
export class BankTransferAdapter implements PaymentProvider {
  readonly name = 'bank_transfer';

  async createPayment(_intent: PaymentIntentInput): Promise<PaymentIntentResult> {
    return {
      id: intentId('bank_transfer'),
      status: 'pending_transfer',
      provider: this.name,
    };
  }
}

/** Noop — optional/disabled by default; no real charge */
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

/** Stripe Connect stub — optional/disabled by default; wire real SDK later */
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

export function isOfflinePaymentMethod(
  value: string,
): value is OfflinePaymentMethod {
  return value === 'cod' || value === 'bank_transfer';
}

/** Resolve offline PaymentProvider for a checkout method */
export function offlineProviderFor(
  method: OfflinePaymentMethod,
): PaymentProvider {
  switch (method) {
    case 'cod':
      return new CodAdapter();
    case 'bank_transfer':
      return new BankTransferAdapter();
  }
}

/* --- Stripe Billing (SaaS merchant←platform) — separate from Connect commerce --- */

export type StripeBillingCheckoutInput = {
  tenantId: string;
  planCode: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
};

export type StripeBillingCheckoutResult = {
  id: string;
  url: string;
  status: 'stub' | 'created';
  provider: 'stripe_billing';
};

export type StripeBillingPortalInput = {
  tenantId: string;
  returnUrl: string;
  stripeCustomerId?: string | null;
};

export type StripeBillingPortalResult = {
  url: string;
  status: 'stub' | 'created';
  provider: 'stripe_billing';
};

/**
 * Optional Stripe Billing stub for merchant SaaS subscriptions.
 * Does not charge; returns placeholder Checkout / Customer Portal URLs.
 * Pass `secretKey` from the host (e.g. Nest `STRIPE_BILLING_SECRET_KEY`) when wiring live SDK later.
 */
export class StripeBillingStub {
  readonly name = 'stripe_billing' as const;

  constructor(private readonly secretKey?: string | null) {}

  isConfigured(): boolean {
    return Boolean(this.secretKey?.trim());
  }

  async createCheckoutSession(
    input: StripeBillingCheckoutInput,
  ): Promise<StripeBillingCheckoutResult> {
    const id = `cs_stub_${input.planCode}_${Date.now().toString(36)}`;
    return {
      id,
      url: `${input.successUrl}${input.successUrl.includes('?') ? '&' : '?'}billing=stub&session=${id}&plan=${encodeURIComponent(input.planCode)}`,
      status: 'stub',
      provider: this.name,
    };
  }

  async createCustomerPortalSession(
    input: StripeBillingPortalInput,
  ): Promise<StripeBillingPortalResult> {
    return {
      url: `${input.returnUrl}${input.returnUrl.includes('?') ? '&' : '?'}billing=portal_stub&tenant=${encodeURIComponent(input.tenantId)}`,
      status: 'stub',
      provider: this.name,
    };
  }
}
