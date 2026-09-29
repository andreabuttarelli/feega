import { loadSession } from '../lib/auth.ts';
import { callEndpoint } from '../lib/api.ts';
import { CHECKOUT_LINK, ONE_TIME_CHECKOUT_LINK, type BrandEndpoint } from '../lib/contracts/index.ts';
import { c, info } from '../lib/display.ts';

export type UpgradeOptions = { eur?: string; topUp?: string };

type Purchase = { endpoint: BrandEndpoint; input: Record<string, number> };

function purchaseOf(opts: UpgradeOptions): Purchase {
  if (opts.topUp) {
    return { endpoint: ONE_TIME_CHECKOUT_LINK, input: { usd: Number(opts.topUp) } };
  }
  return { endpoint: CHECKOUT_LINK, input: opts.eur ? { usd: Number(opts.eur) } : {} };
}

function refusalOf(e: unknown): { error?: string; app_billing_url?: string } {
  const message = e instanceof Error ? e.message : '';
  try {
    return JSON.parse(message.slice(message.indexOf('{')));
  } catch {
    return { error: message };
  }
}

export async function cmdUpgrade(slug: string, opts: UpgradeOptions = {}) {
  const session = await loadSession();
  if (!session) {
    console.error('Session expired or missing. Run: feega login');
    process.exit(1);
  }

  const { endpoint, input } = purchaseOf(opts);
  let url: string;
  try {
    ({ url } = await callEndpoint<{ url: string }>(endpoint as never, session.access_token, slug, input));
  } catch (e) {
    const refusal = refusalOf(e);
    if (!refusal.app_billing_url) {
      console.error(`Checkout refused: ${refusal.error ?? 'unknown error'}`);
      process.exit(1);
    }
    url = refusal.app_billing_url;
  }

  console.log(`\n  ${c.dim(url)}`);
  const { default: open } = await import('open');
  await open(url);
  info('\n  Credits appear on the billing page once Stripe confirms the payment.\n');
}
