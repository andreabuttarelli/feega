import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import '$lib/i18n';
import Page from './+page.svelte';
import { PLAN, TOP_UPS, RETIRED_PLANS } from '$lib/credit-ladder';

const seats = (extra: Record<string, unknown> = {}) => ({ editors: 1, paid: true, billing: 'per_editor', pastDue: false, unpaid: false, grandfathered: false, endsAt: null, renewsAt: null, pricePerEditor: 9, ...extra });
const free = { currentPlan: null, hasBilling: false, seats: seats({ paid: false, billing: 'free' }), agentEdits: { used: 175, limit: 1000, resetsAt: null } };

function page(extra: Record<string, unknown> = {}) {
  const data = {
    org: { id: 'o1', name: 'Acme' },
    credits: { balance: 500 },
    plan: PLAN,
    topUps: TOP_UPS,
    usage: { total: 0, byProject: [], byKind: [] },
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

  it('puts the balance in euros', () => {
    expect(page({ credits: { balance: 994596 } })).toContain('Worth €9,945.96');
  });

  it('compares Free with the plan only while free', () => {
    const body = page(free);
    expect(body).toContain('What the plan adds');
    expect(body).toContain('Unlimited agent edits');
    expect(body).toContain('175 of 1,000 used');
    expect(page()).not.toContain('What the plan adds');
    expect(page()).not.toContain('of 1,000 used');
  });

  it('says when the plan renews', () => {
    expect(page({ seats: seats({ renewsAt: '2026-12-01T12:00:00.000Z' }) })).toContain('Renews on');
  });

  it('sells each top-up from its own card', () => {
    expect(page().match(/data-testid="credits-top-up"/g)).toHaveLength(3);
  });

  it('shows an empty state instead of a list of zeros', () => {
    expect(page()).toContain('No credits spent in the last 30 days.');
  });

  it('breaks usage down by project and kind, with what the balance buys', () => {
    const usage = { total: 400, byProject: [{ id: 'p1', name: 'Launch', credits: 300 }, { id: null, name: null, credits: 100 }], byKind: [{ kind: 'image', credits: 400, calls: 10 }] };
    const body = page({ usage, credits: { balance: 4000 } });
    expect(body).toContain('Launch');
    expect(body).toContain('Outside a project');
    expect(body).toContain('Images');
    expect(body).toContain('100 images');
  });
});
