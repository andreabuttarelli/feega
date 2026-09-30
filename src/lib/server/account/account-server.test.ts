import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { createTestSupabase, type TestSupabase } from '$lib/testkit/supabase';

let kit: TestSupabase;
const rpc = vi.fn(async () => ({ data: { status: 'deleted', org_ids: ['solo'] }, error: null }));

vi.mock('$lib/server/db/client', () => ({ createServiceRoleDb: () => kit.client }));
vi.mock('$lib/server/stripe', () => ({
  ensureSubscriptionCanceled: vi.fn(async () => Promise.reject(new Error('active_plan'))),
  cancelSubscriptionAtPeriodEnd: vi.fn(async () => ({ endsAt: null }))
}));

const { deleteAccountAction, DeleteError } = await import('./account-server');
const stripe = await import('$lib/server/stripe');

const ME = 'user-me';
const signOut = vi.fn(async () => ({ error: null }));

function event(confirm: string, lastSignInAt: string | null) {
  const body = new FormData();
  body.set('confirm', confirm);
  return {
    request: new Request('http://x/', { method: 'POST', body }),
    locals: {
      supabase: { auth: { signOut } },
      safeGetSession: async () => ({ user: { id: ME, email: 'me@x.co', last_sign_in_at: lastSignInAt } })
    }
  } as unknown as RequestEvent;
}

beforeEach(() => {
  kit = createTestSupabase({
    orgs_members: [{ org_id: 'solo', user_id: ME, role: 'owner' }],
    orgs: [{ id: 'solo', stripe_subscription_id: 'sub_1' }]
  });
  (kit.client as unknown as { rpc: typeof rpc }).rpc = rpc;
  (kit.client as unknown as { storage: unknown }).storage = {
    from: () => ({ list: async () => ({ data: [], error: null }), remove: async () => ({ data: [], error: null }) })
  };
  rpc.mockClear();
  signOut.mockClear();
});

const now = () => new Date().toISOString();

describe("l'azione Elimina account", () => {
  it('senza la parola di conferma non cancella', async () => {
    const result = await deleteAccountAction(event('delete', now()));
    expect(result).toMatchObject({ status: 400, data: { deleteError: DeleteError.Confirm } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('con un login vecchio chiede di rientrare', async () => {
    const result = await deleteAccountAction(event('DELETE', '2020-01-01T00:00:00Z'));
    expect(result).toMatchObject({ status: 403, data: { deleteError: DeleteError.Reauth } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("confermata e recente: disdice il piano, cancella, esce e porta al login", async () => {
    await expect(deleteAccountAction(event('me@x.co', now()))).rejects.toMatchObject({
      status: 303,
      location: '/login?deleted=1'
    });
    expect(stripe.cancelSubscriptionAtPeriodEnd).toHaveBeenCalledWith('sub_1', expect.anything());
    expect(rpc).toHaveBeenCalledWith('delete_account', { p_user: ME });
    expect(signOut).toHaveBeenCalled();
  });
});
