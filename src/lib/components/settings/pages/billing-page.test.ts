import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import '$lib/i18n';
import { BillingPlan } from '$lib/billing-plan';
import { CheckoutOutcome } from '$lib/billing-path';
import BillingPage from './BillingPage.svelte';

type Data = Parameters<typeof BillingPage>[1]['data'];

const FREE: Data = { plan: BillingPlan.Free, canManage: true, editors: 2, seatsPaid: 0, renewsAt: null, endsAt: null, pastDue: false };
const CLOUD: Data = { plan: BillingPlan.Cloud, canManage: true, editors: 3, seatsPaid: 3, renewsAt: '2026-12-21T00:00:00.000Z', endsAt: null, pastDue: false };

const html = (data: Data, outcome = CheckoutOutcome.None) => render(BillingPage, { props: { data, outcome } }).body;

describe('billing page, Free editor', () => {
  it('names the plan, offers the upgrade and the annual price with its saving', () => {
    const body = html(FREE);

    expect(body).toContain('Free editor');
    expect(body).toContain('data-testid="billing-upgrade-button"');
    expect(body).not.toContain('data-testid="billing-manage"');
    expect(body).toContain('€12');
    expect(body).toContain('save 20%');
    expect(body).toContain('billed €144 per editor, yearly');
  });

  it('lists what Cloud includes and the FAQ', () => {
    const body = html(FREE);

    expect(body).toContain('Shared sessions, one link to review live');
    expect(body).toContain('Comments on elements, from your phone');
    expect(body).toContain('MCP for agents');
    expect(body).toContain('Unlimited viewers, free');
    expect(body).toContain('Who pays?');
    expect(body).toContain('Editors. Every owner, admin and member takes a seat.');
    expect(body).toContain('Yes. Invite as many viewers as you want');
  });
});

describe('billing page, Cloud', () => {
  it('shows paid seats against editors, the renewal date and manage billing', () => {
    const body = html(CLOUD);

    expect(body).toContain('Feega Cloud');
    expect(body).toContain('editor seats paid');
    expect(body).toContain('21 December 2026');
    expect(body).toContain('data-testid="billing-manage"');
    expect(body).not.toContain('data-testid="billing-upgrade"');
  });

  it('warns about a failed payment', () => {
    expect(html({ ...CLOUD, pastDue: true })).toContain('Your last payment failed');
  });

  it('shows the end date of a canceled plan instead of a renewal', () => {
    const body = html({ ...CLOUD, endsAt: '2027-01-01T00:00:00.000Z' });

    expect(body).toContain('1 January 2027');
    expect(body).toContain('Cloud is canceled');
  });
});

describe('billing page, read only', () => {
  it('disables the actions and says who can change billing', () => {
    const free = html({ ...FREE, canManage: false });
    const cloud = html({ ...CLOUD, canManage: false });

    expect(free).toContain('Only the workspace owner can change billing');
    expect(free).toMatch(/data-testid="billing-upgrade-button"[^>]*disabled|disabled[^>]*data-testid="billing-upgrade-button"/);
    expect(cloud).toMatch(/data-testid="billing-manage"[^>]*disabled|disabled[^>]*data-testid="billing-manage"/);
  });
});

describe('billing page, back from Stripe', () => {
  it('confirms a payment and a canceled checkout', () => {
    expect(html(FREE, CheckoutOutcome.Paid)).toContain('Payment received');
    expect(html(FREE, CheckoutOutcome.Canceled)).toContain('Checkout canceled');
  });
});
