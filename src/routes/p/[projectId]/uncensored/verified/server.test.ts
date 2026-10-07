import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import { fakeDb } from '$lib/server/db/fake-db';

const { keys } = vi.hoisted(() => ({ keys: {} as Record<string, string> }));
vi.mock('$app/environment', () => ({ dev: false, browser: false, building: false }));
vi.mock('$env/dynamic/private', () => ({ env: new Proxy({}, { get: (_t, key) => keys[String(key)] }) }));

const { writer } = vi.hoisted(() => ({ writer: { db: null as unknown } }));
vi.mock('$lib/server/db/client', async (original) => ({
  ...(await original<object>()),
  createServiceRoleDb: () => writer.db
}));

const { GET } = await import('./+server');

const USER = { id: 'user-1' };
const PROJECT = 'proj-1';
const BACK = `/p/${PROJECT}/settings/project`;
const ERASE_URL = 'https://verification.didit.me/v3/session/s-1/delete/';

function event(sessionId: string) {
  const url = new URL(`https://feega.app/p/${PROJECT}/uncensored/verified`);
  url.searchParams.set('verificationSessionId', sessionId);
  url.searchParams.set('status', 'Approved');
  return { url, params: { projectId: PROJECT }, locals: { safeGetSession: async () => ({ session: {}, user: USER }) } };
}

async function settle(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    return await fn();
  } catch (thrown) {
    return thrown;
  }
}

function didit(decision: Record<string, unknown>) {
  const fetch = vi.fn(async (url: string) =>
    new Response(JSON.stringify(String(url).endsWith('/decision/') ? decision : { detail: 'deleted' }), { status: 200 })
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function writes() {
  const fake = fakeDb({});
  writer.db = fake.db;
  return fake.calls;
}

type Fn = (e: unknown) => Promise<unknown>;
const get = GET as unknown as Fn;

beforeEach(() => {
  Object.assign(keys, { DIDIT_API_KEY: 'k', DIDIT_WEBHOOK_SECRET: 's', DIDIT_WORKFLOW_ID: 'w' });
  vi.unstubAllGlobals();
});

describe('the Didit return page', () => {
  it('records the adult verdict read from Didit, then asks Didit to erase the session', async () => {
    const fetch = didit({ session_id: 's-1', status: 'Approved', vendor_data: USER.id });
    const calls = writes();

    const out = await settle(() => get(event('s-1')));

    expect(isRedirect(out) && out.location).toBe(BACK);
    expect(calls.find((c) => c.table === 'user_age_verifications')?.payload).toEqual({
      user_id: USER.id,
      provider: 'didit',
      method: 'age_check',
      result: 'adult',
      provider_session_id: 's-1'
    });
    expect(fetch.mock.calls.map((c) => c[0])).toContain(ERASE_URL);
  });

  it("refuses another user's session even when it was approved", async () => {
    didit({ session_id: 's-1', status: 'Approved', vendor_data: 'someone-else' });
    const calls = writes();

    const out = await settle(() => get(event('s-1')));

    expect(isRedirect(out) && out.location).toBe(`${BACK}?age=failed`);
    expect(calls).toEqual([]);
  });

  it('a declined session stores nothing and is erased', async () => {
    const fetch = didit({ session_id: 's-1', status: 'Declined', vendor_data: USER.id });
    const calls = writes();

    const out = await settle(() => get(event('s-1')));

    expect(isRedirect(out) && out.location).toBe(`${BACK}?age=failed`);
    expect(calls).toEqual([]);
    expect(fetch.mock.calls.map((c) => c[0])).toContain(ERASE_URL);
  });

  it('a session still in review goes back with a pending notice', async () => {
    didit({ session_id: 's-1', status: 'In Review', vendor_data: USER.id });
    writes();

    const out = await settle(() => get(event('s-1')));

    expect(isRedirect(out) && out.location).toBe(`${BACK}?age=pending`);
  });

  it('without Didit keys it fails closed', async () => {
    for (const key of Object.keys(keys)) {
      delete keys[key];
    }
    const fetch = didit({ session_id: 's-1', status: 'Approved', vendor_data: USER.id });
    const calls = writes();

    const out = await settle(() => get(event('s-1')));

    expect(isRedirect(out) && out.location).toBe(`${BACK}?age=failed`);
    expect(fetch).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });
});
