export type BillingPayer = { brandId?: string; orgId?: string };

export const BILLING_UNAVAILABLE_MESSAGE = 'AI is paused: billing cannot be checked right now. Nothing was charged. Try again in a few minutes.';

export class BillingUnavailableError extends Error {
  constructor(public reason: string) {
    super(BILLING_UNAVAILABLE_MESSAGE);
    this.name = 'BillingUnavailableError';
  }
}

export interface BillingProvider {
  readonly kind: 'open' | 'dazero';
  gate(payer: BillingPayer): Promise<void>;
}
