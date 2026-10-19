import { storeProduct, StoreProductKind, type StoreProduct } from '$lib/store-products';

export enum SandboxPolicy {
  Accept = 'accept',
  Ignore = 'ignore'
}

export enum PlanChange {
  Keep = 'keep',
  Set = 'set',
  Clear = 'clear'
}

export type LedgerGrantSource = 'subscription_renewal' | 'one_time_purchase';

export type StoreChange = {
  eventId: string;
  orgId: string;
  store: string;
  environment: 'PRODUCTION' | 'SANDBOX';
  type: string;
  productId: string | null;
  payload: unknown;
  outcome: string;
  grant: { credits: number; source: LedgerGrantSource; expiresAt: string | null } | null;
  revokeCredits: number;
  plan: PlanChange;
  planExpiresAt: string | null;
};

export type RevenueCatReading =
  | { kind: 'apply'; change: StoreChange }
  | { kind: 'ignore'; reason: 'sandbox' | 'no_org' }
  | { kind: 'invalid'; reason: string };

type RawEvent = {
  id?: unknown;
  type?: unknown;
  app_user_id?: unknown;
  product_id?: unknown;
  store?: unknown;
  environment?: unknown;
  expiration_at_ms?: unknown;
  cancel_reason?: unknown;
};

type Effect = { grant: boolean; revoke: boolean; plan: PlanChange };

const NO_EFFECT: Effect = { grant: false, revoke: false, plan: PlanChange.Keep };
const PURCHASE: Effect = { grant: true, revoke: false, plan: PlanChange.Set };
const REFUND: Effect = { grant: false, revoke: true, plan: PlanChange.Clear };
const ENDED: Effect = { grant: false, revoke: false, plan: PlanChange.Clear };

const REFUND_REASON = 'CUSTOMER_SUPPORT';

const EFFECTS: Readonly<Record<string, (event: RawEvent) => Effect>> = {
  INITIAL_PURCHASE: () => PURCHASE,
  RENEWAL: () => PURCHASE,
  NON_RENEWING_PURCHASE: () => PURCHASE,
  CANCELLATION: (event) => (event.cancel_reason === REFUND_REASON ? REFUND : NO_EFFECT),
  EXPIRATION: () => ENDED
};

const GRANT_SOURCE: Readonly<Record<StoreProductKind, LedgerGrantSource>> = {
  [StoreProductKind.Subscription]: 'subscription_renewal',
  [StoreProductKind.CreditPack]: 'one_time_purchase'
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const text = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

const isoFromMs = (value: unknown): string | null =>
  typeof value === 'number' ? new Date(value).toISOString() : null;

export function readRevenueCatEvent(body: unknown, sandbox: SandboxPolicy): RevenueCatReading {
  const event = (body as { event?: RawEvent } | null)?.event;
  const eventId = text(event?.id);
  const type = text(event?.type);
  if (!event || !eventId || !type) {
    return { kind: 'invalid', reason: 'missing_event' };
  }

  const environment = event.environment === 'SANDBOX' ? 'SANDBOX' : 'PRODUCTION';
  if (environment === 'SANDBOX' && sandbox === SandboxPolicy.Ignore) {
    return { kind: 'ignore', reason: 'sandbox' };
  }

  const orgId = text(event.app_user_id);
  if (!orgId || !UUID.test(orgId)) {
    return { kind: 'ignore', reason: 'no_org' };
  }

  const productId = text(event.product_id);
  const product = storeProduct(productId);
  const effect = EFFECTS[type]?.(event) ?? NO_EFFECT;

  return {
    kind: 'apply',
    change: {
      eventId,
      orgId,
      store: text(event.store) ?? 'UNKNOWN',
      environment,
      type,
      productId,
      payload: body,
      ...effectOn(product, effect, isoFromMs(event.expiration_at_ms))
    }
  };
}

type Applied = Pick<StoreChange, 'outcome' | 'grant' | 'revokeCredits' | 'plan' | 'planExpiresAt'>;

function effectOn(product: StoreProduct | undefined, effect: Effect, expiresAt: string | null): Applied {
  if (!product) {
    return { outcome: 'unknown_product', grant: null, revokeCredits: 0, plan: PlanChange.Keep, planExpiresAt: null };
  }

  const subscription = product.kind === StoreProductKind.Subscription;
  const plan = subscription ? effect.plan : PlanChange.Keep;
  const grant = effect.grant
    ? { credits: product.credits, source: GRANT_SOURCE[product.kind], expiresAt: subscription ? expiresAt : null }
    : null;
  const revokeCredits = effect.revoke ? product.credits : 0;
  const changed = grant || revokeCredits || plan !== PlanChange.Keep;

  return {
    outcome: changed ? 'applied' : 'no_effect',
    grant,
    revokeCredits,
    plan,
    planExpiresAt: plan === PlanChange.Set ? expiresAt : null
  };
}
