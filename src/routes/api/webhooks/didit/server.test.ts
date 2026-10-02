import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

const SECRET = 'whsec';
const { keys } = vi.hoisted(() => ({ keys: {} as Record<string, string> }));
vi.mock('$app/environment', () => ({ dev: false, browser: false, building: false }));
vi.mock('$env/dynamic/private', () => ({ env: new Proxy({}, { get: (_t, key) => keys[String(key)] }) }));

const { writer } = vi.hoisted(() => ({ writer: { db: null as unknown } }));
vi.mock('$lib/server/db/client', async (original) => ({
  ...(await original<object>()),
  createServiceRoleDb: () => writer.db
}));

const { POST } = await import('./+server');

const HTTP_OK = 200;
const HTTP_UNAUTHORIZED = 401;
const HTTP_UNAVAILABLE = 503;
const REPLAY_AGE_SECONDS = 600;

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function request(status: string, { secret = SECRET, sentAt = nowSeconds() } = {}) {
  const body = JSON.stringify({ webhook_type: 'status.updated', session_id: 's-1', vendor_data: 'user-1', status });
  const signature = createHmac('sha256', secret).update(body).digest('hex');
  return {
    request: new Request('https://feega.app/api/webhooks/didit', {
      method: 'POST',
      body,
      headers: { 'x-signature': signature, 'x-timestamp': String(sentAt), 'content-type': 'application/json' }
    })
  };
}

function writes() {
  const fake = fakeDb({});
  writer.db = fake.db;
  return fake.calls;
}

type Fn = (e: unknown) => Promise<Response>;
const post = POST as unknown as Fn;

let fetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  Object.assign(keys, { DIDIT_API_KEY: 'k', DIDIT_WEBHOOK_SECRET: SECRET, DIDIT_WORKFLOW_ID: 'w' });
  fetch = vi.fn(async () => new Response('{}', { status: HTTP_OK }));
  vi.stubGlobal('fetch', fetch);
});

describe('the Didit webhook', () => {
  it('a signed approval is recorded keyed on the session, so a redelivery cannot add a row', async () => {
    const calls = writes();

    const first = await post(request('Approved'));
    await post(request('Approved'));

    expect(first.status).toBe(HTTP_OK);
    const rows = calls.filter((c) => c.table === 'user_age_verifications');
    expect(rows.map((c) => c.op)).toEqual(['upsert', 'upsert']);
    expect(rows[0]?.payload).toMatchObject({ user_id: 'user-1', provider: 'didit', provider_session_id: 's-1' });
  });

  it('an invalid signature is refused and writes nothing', async () => {
    const calls = writes();

    const out = await post(request('Approved', { secret: 'forged' }));

    expect(out.status).toBe(HTTP_UNAUTHORIZED);
    expect(calls).toEqual([]);
  });

  it('a replay outside the five-minute window is refused', async () => {
    const calls = writes();

    const out = await post(request('Approved', { sentAt: nowSeconds() - REPLAY_AGE_SECONDS }));

    expect(out.status).toBe(HTTP_UNAUTHORIZED);
    expect(calls).toEqual([]);
  });

  it('a session still in review is acknowledged without a verdict or an erasure', async () => {
    const calls = writes();

    const out = await post(request('In Review'));

    expect(out.status).toBe(HTTP_OK);
    expect(calls).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('without Didit keys it fails closed', async () => {
    for (const key of Object.keys(keys)) {
      delete keys[key];
    }
    const out = await post(request('Approved'));
    expect(out.status).toBe(HTTP_UNAVAILABLE);
  });
});
