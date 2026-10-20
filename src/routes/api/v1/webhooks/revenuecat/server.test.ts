import { beforeEach, describe, expect, it, vi } from 'vitest';
import samples from '$lib/server/billing/revenuecat-samples.json';

const SECRET = 'rc-secret';
const { keys } = vi.hoisted(() => ({ keys: {} as Record<string, string | undefined> }));
vi.mock('$env/dynamic/private', () => ({ env: new Proxy({}, { get: (_t, key) => keys[String(key)] }) }));

const { db } = vi.hoisted(() => ({ db: { rpc: vi.fn() } }));
vi.mock('$lib/server/db/client', async (original) => ({
  ...(await original<object>()),
  createServiceRoleDb: () => db
}));

const { POST } = await import('./+server');

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_SERVER_ERROR = 500;
const HTTP_UNAVAILABLE = 503;

type Fn = (e: unknown) => Promise<Response>;
const post = POST as unknown as Fn;

function call(body: unknown, authorization: string | null = `Bearer ${SECRET}`) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (authorization) {
    headers.authorization = authorization;
  }
  return post({
    request: new Request('https://feega.app/api/v1/webhooks/revenuecat', { method: 'POST', body: JSON.stringify(body), headers })
  });
}

beforeEach(() => {
  Object.assign(keys, { REVENUECAT_WEBHOOK_SECRET: SECRET, REVENUECAT_SANDBOX: undefined });
  db.rpc = vi.fn(async () => ({ data: 'applied', error: null }));
});

describe('the RevenueCat webhook', () => {
  it('refuses every call while no secret is configured', async () => {
    keys.REVENUECAT_WEBHOOK_SECRET = undefined;

    const res = await call(samples.initialPurchase);

    expect(res.status).toBe(HTTP_UNAVAILABLE);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it('refuses a wrong or missing authorization header', async () => {
    expect((await call(samples.initialPurchase, 'Bearer nope')).status).toBe(HTTP_UNAUTHORIZED);
    expect((await call(samples.initialPurchase, null)).status).toBe(HTTP_UNAUTHORIZED);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it('applies a purchase through apply_store_event in one call keyed on the event id', async () => {
    const res = await call(samples.initialPurchase);

    expect(res.status).toBe(HTTP_OK);
    expect(await res.json()).toEqual({ ok: true, outcome: 'applied' });
    expect(db.rpc).toHaveBeenCalledWith('apply_store_event', {
      _event_id: samples.initialPurchase.event.id,
      _org_id: samples.initialPurchase.event.app_user_id,
      _store: 'APP_STORE',
      _environment: 'PRODUCTION',
      _type: 'INITIAL_PURCHASE',
      _product_id: 'feega_monthly_16',
      _payload: samples.initialPurchase,
      _outcome: 'applied',
      _grant_credits: 1600,
      _grant_source: 'subscription_renewal',
      _grant_expires_at: '2025-11-19T08:00:00.000Z',
      _revoke_credits: 0,
      _plan: 'set',
      _plan_expires_at: '2025-11-19T08:00:00.000Z'
    });
  });

  it('answers 200 to a redelivery the database already holds, so RevenueCat stops retrying', async () => {
    db.rpc = vi.fn(async () => ({ data: 'duplicate', error: null }));

    const res = await call(samples.renewal);

    expect(res.status).toBe(HTTP_OK);
    expect(await res.json()).toEqual({ ok: true, outcome: 'duplicate' });
  });

  it('ignores sandbox events unless sandbox is accepted', async () => {
    const ignored = await call(samples.sandboxPurchase);
    expect(await ignored.json()).toEqual({ ok: true, outcome: 'ignored', reason: 'sandbox' });
    expect(db.rpc).not.toHaveBeenCalled();

    keys.REVENUECAT_SANDBOX = 'accept';
    const applied = await call(samples.sandboxPurchase);
    expect(await applied.json()).toEqual({ ok: true, outcome: 'applied' });
  });

  it('answers the dashboard test event without writing', async () => {
    keys.REVENUECAT_SANDBOX = 'accept';

    const res = await call(samples.dashboardTest);

    expect(res.status).toBe(HTTP_OK);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it('ignores an app user id that is not an org instead of retrying forever', async () => {
    db.rpc = vi.fn(async () => ({ data: null, error: { code: '23503', message: 'fk' } }));

    const res = await call(samples.creditPack);

    expect(res.status).toBe(HTTP_OK);
    expect(await res.json()).toEqual({ ok: true, outcome: 'ignored', reason: 'unknown_org' });
  });

  it('answers 500 on any other database failure so RevenueCat retries', async () => {
    db.rpc = vi.fn(async () => ({ data: null, error: { code: '57014', message: 'timeout' } }));

    expect((await call(samples.creditPack)).status).toBe(HTTP_SERVER_ERROR);
  });

  it('rejects a body that is not an event', async () => {
    expect((await call({ hello: 'world' })).status).toBe(HTTP_BAD_REQUEST);
  });
});
