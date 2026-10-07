import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import { fakeDb } from '$lib/server/db/fake-db';

const { devManual, keys } = vi.hoisted(() => ({ devManual: { on: 'true' }, keys: {} as Record<string, string> }));
vi.mock('$app/environment', () => ({ dev: true, browser: false, building: false }));
vi.mock('$env/dynamic/private', () => ({
  env: new Proxy({}, { get: (_t, key) => (key === 'UNCENSORED_DEV_MANUAL_VERIFICATION' ? devManual.on : keys[String(key)]) })
}));

const { writer } = vi.hoisted(() => ({ writer: { db: null as unknown } }));
vi.mock('$lib/server/db/client', async (original) => ({
  ...(await original<object>()),
  createServiceRoleDb: () => writer.db
}));

const { actions } = await import('./+page.server');

const ORG = 'org-1';
const PROJECT = 'proj-1';
const USER = { id: 'user-1', email: 'u@example.com', user_metadata: {} };

type Seed = { optedIn?: boolean; paid?: boolean; verified?: boolean };

function seed({ optedIn = true, paid = true, verified = true }: Seed = {}) {
  return {
    orgs_members: [{ user_id: USER.id, role: 'owner', orgs: { id: ORG, name: 'Acme', slug: 'acme' } }],
    orgs: [{ id: ORG, stripe_subscription_id: paid ? 'sub_1' : null }],
    projects: [{ id: PROJECT, org_id: ORG, name: 'Main', slug: 'main', brand_id: null, archived_at: null, mode: 'standard', updated_at: '2026-09-29T00:00:00Z', canvases: [] }],
    org_uncensored_optins: optedIn ? [{ org_id: ORG, enabled_by: USER.id, enabled_at: '2026-09-29T00:00:00Z', disabled_at: null }] : [],
    feature_flags: [{ key: 'uncensored_mode', enabled: false }],
    user_age_verifications: verified ? [{ id: 'v1', user_id: USER.id, provider: 'manual_admin', method: 'manual_admin', result: 'adult' }] : []
  };
}

function event(db: unknown, fields: Record<string, string> = {}) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.append(key, value);
  }
  return {
    request: { formData: async () => fd },
    url: new URL(`https://feega.app/p/${PROJECT}/settings/project`),
    params: { projectId: PROJECT },
    locals: { db: async () => db, safeGetSession: async () => ({ session: {}, user: USER }) }
  };
}

async function settle<T>(fn: () => Promise<T>): Promise<T | unknown> {
  try {
    return await fn();
  } catch (thrown) {
    return thrown;
  }
}

type Fn = (e: unknown) => Promise<unknown>;

beforeEach(() => {
  devManual.on = 'true';
  for (const key of Object.keys(keys)) {
    delete keys[key];
  }
  vi.unstubAllGlobals();
});

describe('settings/project verifyAge: the age step of the uncensored switch', () => {
  it('verification stores an adult verdict through the manual_admin adapter', async () => {
    const { db } = fakeDb(seed({ verified: false }), { filter: true });
    const writes = fakeDb({});
    writer.db = writes.db;

    const out = await (actions.verifyAge as Fn)(event(db));

    expect(out).toEqual({ verified: true });
    expect(writes.calls.find((c) => c.table === 'user_age_verifications' && c.op === 'insert')?.payload).toEqual({
      user_id: USER.id,
      provider: 'manual_admin',
      method: 'manual_admin',
      result: 'adult'
    });
  });

  it('with Didit keys, verification sends the user to Didit and stores nothing yet', async () => {
    devManual.on = 'false';
    Object.assign(keys, { DIDIT_API_KEY: 'k', DIDIT_WEBHOOK_SECRET: 's', DIDIT_WORKFLOW_ID: 'w' });
    const fetch = vi.fn(async () => new Response(JSON.stringify({ session_id: 's-1', url: 'https://verify.didit.me/session/abc' }), { status: 201 }));
    vi.stubGlobal('fetch', fetch);
    const { db } = fakeDb({ ...seed({ verified: false }), feature_flags: [{ key: 'uncensored_mode', enabled: true }] }, { filter: true });
    const writes = fakeDb({});
    writer.db = writes.db;

    const out = await settle(() => (actions.verifyAge as Fn)(event(db)));

    expect(isRedirect(out) && out.location).toBe('https://verify.didit.me/session/abc');
    const body = JSON.parse(String((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body).toEqual({ workflow_id: 'w', vendor_data: USER.id, callback: `https://feega.app/p/${PROJECT}/uncensored/verified` });
    expect(writes.calls.some((c) => c.table === 'user_age_verifications')).toBe(false);
  });
});
