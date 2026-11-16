import type { BillingProvider } from '$lib/billing/contract';
import { gateCreditsCore, gateOrgCreditsCore } from '$lib/server/credits';

export const dazeroBillingProvider: BillingProvider = {
  kind: 'dazero',

  async gate(payer) {
    if (payer.brandId) return gateCreditsCore(payer.brandId);
    if (payer.orgId) return gateOrgCreditsCore(payer.orgId);
  }
};
