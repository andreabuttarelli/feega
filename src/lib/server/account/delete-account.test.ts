import { describe, expect, it, vi } from 'vitest';
import { createTestSupabase } from '$lib/testkit/supabase';
import { DeletionOutcome, deleteAccountWith, planDeletion, type AccountDeps } from './delete-account';

const ME = 'user-me';
const OTHER = 'user-other';

function deps(seed: Record<string, Record<string, unknown>[]>, overrides: Partial<AccountDeps> = {}) {
  const kit = createTestSupabase(seed);
  const rpc = vi.fn(async () => ({ data: { status: 'deleted', org_ids: [] }, error: null }));
  (kit.client as unknown as { rpc: typeof rpc }).rpc = rpc;
  const removed: string[] = [];
  const d: AccountDeps = {
    db: kit.client,
    removePrefix: async (bucket, prefix) => {
      removed.push(`${bucket}:${prefix}`);
    },
    cancelAtPeriodEnd: vi.fn(async () => {}),
    ...overrides
  };
  return { d, rpc, removed };
}

describe('planDeletion', () => {
  it("un'org con solo me si cancella, una con un altro proprietario resta", () => {
    const plan = planDeletion(ME, [
      { org_id: 'solo', user_id: ME, role: 'owner' },
      { org_id: 'shared', user_id: ME, role: 'owner' },
      { org_id: 'shared', user_id: OTHER, role: 'owner' }
    ]);
    expect(plan).toEqual({ deleteOrgs: ['solo'], blockedOrgs: [] });
  });

  it('unico proprietario con altri membri: serve trasferire', () => {
    const plan = planDeletion(ME, [
      { org_id: 'team', user_id: ME, role: 'owner' },
      { org_id: 'team', user_id: OTHER, role: 'member' }
    ]);
    expect(plan).toEqual({ deleteOrgs: [], blockedOrgs: ['team'] });
  });
});

describe('deleteAccountWith', () => {
  it("non cancella nulla se un'org resterebbe senza proprietario", async () => {
    const { d, rpc } = deps({
      orgs_members: [
        { org_id: 'team', user_id: ME, role: 'owner' },
        { org_id: 'team', user_id: OTHER, role: 'member' }
      ],
      orgs: [{ id: 'team', stripe_subscription_id: 'sub_1' }]
    });

    const result = await deleteAccountWith(d, ME);

    expect(result).toEqual({ outcome: DeletionOutcome.TransferRequired, orgIds: ['team'] });
    expect(rpc).not.toHaveBeenCalled();
    expect(d.cancelAtPeriodEnd).not.toHaveBeenCalled();
  });

  it("disdice l'abbonamento dell'org che sparisce, poi cancella e pulisce lo storage", async () => {
    const { d, rpc, removed } = deps({
      orgs_members: [{ org_id: 'solo', user_id: ME, role: 'owner' }],
      orgs: [{ id: 'solo', stripe_subscription_id: 'sub_1' }]
    });

    const result = await deleteAccountWith(d, ME);

    expect(result.outcome).toBe(DeletionOutcome.Deleted);
    expect(d.cancelAtPeriodEnd).toHaveBeenCalledWith('sub_1');
    expect(rpc).toHaveBeenCalledWith('delete_account', { p_user: ME });
    expect(removed).toEqual(
      expect.arrayContaining([
        `brand-knowledge:${ME}`,
        `media:${ME}`,
        'canvas-assets:solo',
        'influencers:solo'
      ])
    );
  });

  it("i dati di un'org condivisa restano", async () => {
    const { d, removed } = deps({
      orgs_members: [
        { org_id: 'shared', user_id: ME, role: 'member' },
        { org_id: 'shared', user_id: OTHER, role: 'owner' }
      ],
      orgs: [{ id: 'shared', stripe_subscription_id: 'sub_2' }]
    });

    await deleteAccountWith(d, ME);

    expect(d.cancelAtPeriodEnd).not.toHaveBeenCalled();
    expect(removed.some((r) => r.includes('shared'))).toBe(false);
  });

  it('se Stripe fallisce, niente viene cancellato', async () => {
    const { d, rpc } = deps(
      {
        orgs_members: [{ org_id: 'solo', user_id: ME, role: 'owner' }],
        orgs: [{ id: 'solo', stripe_subscription_id: 'sub_1' }]
      },
      { cancelAtPeriodEnd: vi.fn(async () => Promise.reject(new Error('stripe down'))) }
    );

    await expect(deleteAccountWith(d, ME)).rejects.toThrow('stripe down');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('lo storage riprova un errore transitorio', async () => {
    let failures = 1;
    const seen: string[] = [];
    const { d } = deps(
      { orgs_members: [], orgs: [] },
      {
        removePrefix: async (bucket, prefix) => {
          if (bucket === 'media' && failures-- > 0) {
            throw new Error('timeout');
          }
          seen.push(`${bucket}:${prefix}`);
        }
      }
    );

    await deleteAccountWith(d, ME);

    expect(seen).toContain(`media:${ME}`);
  });
});
