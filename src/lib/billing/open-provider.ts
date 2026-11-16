import type { BillingProvider } from './contract';

export const openBillingProvider: BillingProvider = {
  kind: 'open',
  async gate() {}
};
