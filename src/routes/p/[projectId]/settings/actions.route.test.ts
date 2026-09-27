import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb, type Call } from '$lib/server/db/fake-db';

const syncBrandAccounts = vi.fn();
const disconnectAccount = vi.fn();

vi.mock('$lib/server/tenancy', () => ({ hasManyTenants: () => true }));
vi.mock('$lib/server/zernio', () => ({
  syncBrandAccounts: (...a: unknown[]) => syncBrandAccounts(...a),
  disconnectAccount: (...a: unknown[]) => disconnectAccount(...a)
}));
vi.mock('$lib/server/social-connections', () => ({ canAffordSeat: async () => true }));
vi.mock('$lib/server/email', () => ({
  sendEmail: vi.fn(),
  brandInviteEmailSubject: () => 's',
  brandInviteEmailHtml: () => 'h',
  brandInviteEmailText: () => 't'
}));

import { actions as apiKeyActions } from './api-keys/+page.server';
import { actions as teamActions } from './team/+page.server';
import { actions as accountActions } from './connected-accounts/+page.server';
import { actions as dangerActions } from './danger/+page.server';

const USER = 'user-1';
const ORG = 'org-1';
const PROJECT = 'project-1';
const BRAND = { id: 'brand-1', slug: 'acme', name: 'Acme', org_id: ORG, zernio_profile_id: 'zp-1' };

type Rows = Record<string, unknown[]>;

function baseRows(brandId: string | null): Rows {
  return {
    projects: [{ id: PROJECT, org_id: ORG, brand_id: brandId, archived_at: null }],
    brands: [BRAND],
    orgs_members: [{ org_id: ORG, user_id: USER, role: 'owner' }],
    orgs_invites: [{ id: 'inv-1', org_id: ORG, email: 'x@y.com', role: 'member', expires_at: '', accepted_at: null, created_at: '' }],
    orgs: [{ id: ORG, name: 'Org', stripe_customer_id: null, stripe_subscription_id: null }],
    social_accounts: [{ id: 'acc-1', brand_id: BRAND.id, zernio_account_id: 'z-1' }]
  };
}

function event(rows: Rows, form: Record<string, string> = {}) {
  const { db, calls } = fakeDb(rows, { filter: true });
  const supabase = Object.assign(db, {
    auth: { getUser: async () => ({ data: { user: { id: USER, email: 'owner@example.com' } } }) }
  });
  const fd = new FormData();
  for (const [k, v] of Object.entries(form)) {
    fd.set(k, v);
  }
  return {
    calls,
    ev: {
      request: { formData: async () => fd },
      params: { projectId: PROJECT },
      url: new URL(`https://feega.test/p/${PROJECT}/settings`),
      cookies: { get: () => undefined },
      locals: { supabase, db: async () => supabase, safeGetSession: async () => ({ user: { id: USER } }) }
    }
  };
}

const run = (fn: unknown, ev: unknown) => (fn as (e: unknown) => Promise<unknown>)(ev);
const writes = (calls: Call[], table: string, op: string) => calls.filter((c) => c.table === table && c.op === op);

beforeEach(() => {
  vi.clearAllMocks();
  disconnectAccount.mockResolvedValue(undefined);
});

describe('le azioni delle impostazioni leggono il progetto, non un params.brand che non esiste', () => {
  it.each([null, BRAND.id])('crea una chiave API per l org del progetto (brand %s)', async (brandId) => {
    const { ev, calls } = event(baseRows(brandId), { key_name: 'CI' });

    const result = await run(apiKeyActions.createApiKey, ev);

    expect(result).toMatchObject({ apiKeyCreated: true });
    expect(writes(calls, 'api_keys', 'insert')[0].payload).toMatchObject({ org_id: ORG, user_id: USER });
  });

  it('revoca una chiave API dentro l org del progetto', async () => {
    const { ev, calls } = event(baseRows(null), { key_id: 'k-1' });

    const result = await run(apiKeyActions.revokeApiKey, ev);

    expect(result).toMatchObject({ apiKeyRevoked: true });
    expect(writes(calls, 'api_keys', 'delete')[0].filters).toContainEqual(['org_id', ORG]);
  });

  it.each([null, BRAND.id])('invita nell org del progetto (brand %s)', async (brandId) => {
    const { ev, calls } = event(baseRows(brandId), { email: 'new@y.com' });

    const result = await run(teamActions.invite, ev);

    expect(result).toMatchObject({ teamInvited: true });
    expect(writes(calls, 'orgs_invites', 'insert')[0].payload).toMatchObject({ org_id: ORG, email: 'new@y.com' });
  });

  it('revoca un invito dell org del progetto', async () => {
    const { ev } = event(baseRows(null), { invite_id: 'inv-1' });

    await expect(run(teamActions.revokeInvite, ev)).resolves.toMatchObject({ teamRevoked: true });
  });

  it('sincronizza gli account del brand del progetto', async () => {
    const { ev } = event(baseRows(BRAND.id));

    const result = await run(accountActions.sync, ev);

    expect(result).toMatchObject({ synced: true });
    expect(syncBrandAccounts).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: BRAND.id, org_id: ORG }));
  });

  it('senza brand la sincronizzazione risponde, non esplode', async () => {
    const { ev } = event(baseRows(null));

    await expect(run(accountActions.sync, ev)).resolves.toMatchObject({ error: expect.any(String) });
  });

  it('scollega un account del brand del progetto', async () => {
    const { ev, calls } = event(baseRows(BRAND.id), { id: 'acc-1' });

    const result = await run(accountActions.disconnect, ev);

    expect(result).toMatchObject({ disconnected: true });
    expect(disconnectAccount).toHaveBeenCalledWith('z-1');
    expect(writes(calls, 'social_accounts', 'delete')[0].filters).toContainEqual(['brand_id', BRAND.id]);
  });

  it('cancella il brand del progetto quando il nome combacia', async () => {
    const { ev, calls } = event(baseRows(BRAND.id), { confirm: 'Acme' });

    const outcome = await run(dangerActions.deleteBrand, ev).catch((e: unknown) => e);

    expect(outcome).toMatchObject({ status: 303 });
    expect(writes(calls, 'brands', 'delete')[0].filters).toContainEqual(['id', BRAND.id]);
    expect((outcome as { location: string }).location).toBe(`/p/${PROJECT}/settings/brand`);
  });

  it('un progetto di un altra org non si raggiunge', async () => {
    const rows = baseRows(BRAND.id);
    rows.projects = [];
    const { ev, calls } = event(rows, { key_name: 'CI' });

    const result = await run(apiKeyActions.createApiKey, ev);

    expect(result).toMatchObject({ status: 404 });
    expect(writes(calls, 'api_keys', 'insert')).toHaveLength(0);
  });
});
