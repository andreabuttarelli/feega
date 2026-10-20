import { describe, expect, it } from 'vitest';
import samples from './revenuecat-samples.json';
import { PlanChange, readRevenueCatEvent, SandboxPolicy, type StoreChange } from './revenuecat';

const ORG = '7d0c6a2e-4b1f-4a8e-9a43-2f3f1c9b5e10';

function change(body: unknown, sandbox = SandboxPolicy.Ignore): StoreChange {
  const reading = readRevenueCatEvent(body, sandbox);
  if (reading.kind !== 'apply') {
    throw new Error(`expected apply, got ${reading.kind}: ${reading.reason}`);
  }
  return reading.change;
}

describe('readRevenueCatEvent', () => {
  it('a first subscription purchase grants the rung credits until the period ends and sets the plan', () => {
    const c = change(samples.initialPurchase);

    expect(c.orgId).toBe(ORG);
    expect(c.eventId).toBe(samples.initialPurchase.event.id);
    expect(c.store).toBe('APP_STORE');
    expect(c.grant).toEqual({ credits: 1600, source: 'subscription_renewal', expiresAt: '2025-11-19T08:00:00.000Z' });
    expect(c.revokeCredits).toBe(0);
    expect(c.plan).toBe(PlanChange.Set);
    expect(c.planExpiresAt).toBe('2025-11-19T08:00:00.000Z');
  });

  it('a renewal from Play grants the next period under its own event id', () => {
    const c = change(samples.renewal);

    expect(c.store).toBe('PLAY_STORE');
    expect(c.grant?.credits).toBe(1600);
    expect(c.grant?.expiresAt).toBe('2025-12-19T08:00:00.000Z');
    expect(c.plan).toBe(PlanChange.Set);
  });

  it('a credit pack grants permanent credits and leaves the plan alone', () => {
    const c = change(samples.creditPack);

    expect(c.grant).toEqual({ credits: 3200, source: 'one_time_purchase', expiresAt: null });
    expect(c.plan).toBe(PlanChange.Keep);
  });

  it('a refunded pack takes its credits back', () => {
    const c = change(samples.packRefund);

    expect(c.grant).toBeNull();
    expect(c.revokeCredits).toBe(3200);
    expect(c.plan).toBe(PlanChange.Keep);
  });

  it('a refunded subscription takes the period credits back and ends the plan now', () => {
    const c = change(samples.subscriptionRefund);

    expect(c.revokeCredits).toBe(1600);
    expect(c.plan).toBe(PlanChange.Clear);
  });

  it('turning auto-renew off changes nothing: the paid period runs to its end', () => {
    const c = change(samples.cancellation);

    expect(c.grant).toBeNull();
    expect(c.revokeCredits).toBe(0);
    expect(c.plan).toBe(PlanChange.Keep);
    expect(c.outcome).toBe('no_effect');
  });

  it('an expiration ends the store plan without touching credits already granted', () => {
    const c = change(samples.expiration);

    expect(c.grant).toBeNull();
    expect(c.revokeCredits).toBe(0);
    expect(c.plan).toBe(PlanChange.Clear);
  });

  it('a sandbox purchase is ignored unless sandbox is accepted', () => {
    expect(readRevenueCatEvent(samples.sandboxPurchase, SandboxPolicy.Ignore)).toEqual({ kind: 'ignore', reason: 'sandbox' });
    expect(change(samples.sandboxPurchase, SandboxPolicy.Accept).environment).toBe('SANDBOX');
  });

  it('the dashboard test event has no org and is ignored', () => {
    expect(readRevenueCatEvent(samples.dashboardTest, SandboxPolicy.Accept)).toEqual({ kind: 'ignore', reason: 'no_org' });
  });

  it('an unknown product is recorded and grants nothing', () => {
    const body = { event: { ...samples.creditPack.event, product_id: 'someone_elses_product' } };
    const c = change(body);

    expect(c.grant).toBeNull();
    expect(c.outcome).toBe('unknown_product');
  });

  it('a body without an event id is invalid', () => {
    expect(readRevenueCatEvent({ event: { type: 'RENEWAL' } }, SandboxPolicy.Accept).kind).toBe('invalid');
    expect(readRevenueCatEvent(null, SandboxPolicy.Accept).kind).toBe('invalid');
  });
});
