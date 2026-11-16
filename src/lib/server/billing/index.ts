import { env } from '$env/dynamic/private';
import { BillingUnavailableError, type BillingProvider } from '$lib/billing/contract';
import { openBillingProvider } from '$lib/billing/open-provider';
import { localStore } from '$lib/server/local/local-mode';
import { swallow } from '$lib/server/swallow';

let fallbackReported = false;

function closedProvider(reason: string): BillingProvider {
  return {
    kind: 'dazero',
    async gate() {
      throw new BillingUnavailableError(reason);
    }
  };
}

function refuseSpending(reason: string, err?: unknown): BillingProvider {
  if (!fallbackReported) {
    fallbackReported = true;
    swallow(`billing: paid provider unavailable, AI spending is refused (${reason})`, err);
  }
  return closedProvider(reason);
}

export async function billingProvider(): Promise<BillingProvider> {
  if (env.BILLING_PROVIDER === 'open' || localStore()) return openBillingProvider;
  try {
    const { dazeroBillingProvider } = await import('./dazero-provider');
    return dazeroBillingProvider ?? refuseSpending('module exported no provider');
  } catch (e) {
    return refuseSpending('module failed to load', e);
  }
}
