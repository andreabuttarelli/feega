import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import '$lib/i18n';
import Page from './+page.svelte';
import { PLAN, TOP_UPS, RETIRED_PLANS } from '$lib/credit-ladder';

const seats = (extra: Record<string, unknown> = {}) => ({ editors: 1, paid: true, billing: 'per_editor', pastDue: false, unpaid: false, grandfathered: false, endsAt: null, pricePerEditor: 9, ...extra });

function page(extra: Record<string, unknown> = {}) {
  const data = {
    org: { id: 'o1', name: 'Acme' },
    credits: { balance: 500 },
    plan: PLAN,
    topUps: TOP_UPS,
    brands: [],
    hasBilling: true,
    currentPlan: PLAN,
    seats: seats(),
    agentEdits: null,
    checkoutOutcome: 'none',
    isOwner: true,
    purchasesReady: true,
    billingChannel: 'web',
    ...extra
  };
  return render(Page, { props: { data, form: null } as never }).body.replace(/<!--[^>]*-->/g, '');
}

describe('/app/credits as the owner reads it', () => {
  it('counts one editor in the singular', () => {
    expect(page()).toContain('€9 × 1 editor = €9 / month');
    expect(page({ seats: seats({ editors: 2 }) })).toContain('Cancelling turns 1 editor into a viewer');
  });

  it('quotes a retired per-team price without a per-editor rate', () => {
    const legacy = RETIRED_PLANS[0];
    const body = page({ currentPlan: legacy, seats: seats({ billing: 'legacy', editors: 3 }) });

    expect(body).toContain(`€${legacy.price} / month`);
    expect(body).not.toContain('/ editor');
  });

  it('says the payment failed when the plan is past due or unpaid', () => {
    expect(page({ seats: seats({ pastDue: true }) })).toMatch(/past due/);
    expect(page({ seats: seats({ unpaid: true }) })).toMatch(/plan is unpaid/);
    expect(page()).not.toMatch(/past due|is unpaid/);
  });

  it('names the editors who turn viewers when the plan ends, in the singular too', () => {
    expect(page({ seats: seats({ editors: 2, endsAt: '2026-12-13T00:00:00.000Z' }) })).toContain('Then 1 editor becomes a viewer.');
  });
});
