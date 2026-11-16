import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestSupabase } from '$lib/testkit/supabase';

beforeEach(() => {
  vi.resetModules();
});

describe('gateCreditsCore fails CLOSED when the org cannot be resolved from brands', () => {
  it('denies the spend when the brand row itself cannot be read', async () => {
    vi.doMock('./ai-log', () => ({ isCreditExempt: () => false }));
    const swallowed: unknown[] = [];
    vi.doMock('$lib/server/swallow', () => ({
      swallow: (reason: string, err?: unknown) => {
        swallowed.push({ reason, err });
      }
    }));

    const { client } = createTestSupabase({ brands: [], ai_calls: [] });
    vi.doMock('./supabase-admin', () => ({ createAdminClient: () => client }));

    const { gateCreditsCore } = await import('./credits');

    const { BillingUnavailableError } = await import('$lib/billing/contract');
    await expect(gateCreditsCore('missing-brand')).rejects.toBeInstanceOf(BillingUnavailableError);
  });

  it('denies the spend once ai_calls spend crosses the free quota, with no plan to inflate it', async () => {
    vi.doMock('./ai-log', () => ({ isCreditExempt: () => false }));

    const { client } = createTestSupabase({
      orgs: [{ id: 'org-1' }],
      brands: [{ id: 'brand-1', org_id: 'org-1' }],
      ai_calls: [{ id: '1', org_id: 'org-1', cost_usd: 5, created_at: new Date().toISOString() }] // 500 credits > free quota
    });
    vi.doMock('./supabase-admin', () => ({ createAdminClient: () => client }));

    const { gateCreditsCore, CreditsExhaustedError } = await import('./credits');

    await expect(gateCreditsCore('brand-1')).rejects.toBeInstanceOf(CreditsExhaustedError);
  });
});
