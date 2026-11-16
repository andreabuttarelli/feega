import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createTestSupabase } from '$lib/testkit/supabase';

// credits.ts caches the resolved org for 5 minutes at module scope. Without a reset each test
// would answer from the previous one's seed — and quietly pass for it.
beforeEach(() => {
  vi.resetModules();
});

const ORG = 'org-1';

describe('gateCreditsCore, org-scoped balance', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('two brands of the same org read the same pool, fresh each time', async () => {
    const { client, rpcCalls } = createTestSupabase({
      orgs: [{ id: ORG }],
      brands: [
        { id: 'brand-a', org_id: ORG },
        { id: 'brand-b', org_id: ORG }
      ]
    });
    client.rpc = (async (fn: string, args?: unknown) => {
      rpcCalls.push({ fn, args });
      return { data: 1000, error: null };
    }) as unknown as typeof client.rpc;
    vi.doMock('./supabase-admin', () => ({ createAdminClient: () => client }));
    vi.doMock('./ai-log', () => ({ isCreditExempt: () => false }));

    const { gateCreditsCore } = await import('./credits');
    await gateCreditsCore('brand-a');
    await gateCreditsCore('brand-b');

    expect(rpcCalls.filter((c) => c.fn === 'credit_gate')).toEqual([
      { fn: 'credit_gate', args: { _org_id: ORG } },
      { fn: 'credit_gate', args: { _org_id: ORG } }
    ]);
  });
});
