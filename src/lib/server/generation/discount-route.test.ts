import { describe, expect, it } from 'vitest';
import { kieModelRows } from '../kie-catalogue';
import { discountCandidateOf, discountRouteFor, RouteHealth, routeHealthOf, type CallSample } from './discount-route';

const SYNCED = '2026-10-15T00:00:00.000Z';
const banana = discountCandidateOf(kieModelRows(SYNCED).find((row) => row.id === 'kie/nano-banana-2')!)!;

describe('discountRouteFor — when the cheaper kie route is tried first', () => {
  it('takes kie for a resolution kie prices, below the primary price', () => {
    expect(discountRouteFor({ candidate: banana, health: RouteHealth.Healthy, params: { resolution: '2K' }, primaryUsd: 0.1 })).toEqual({
      modelId: 'kie/nano-banana-2',
      usd: 0.06,
      params: { resolution: '2K' }
    });
  });

  it('fills kie\'s default resolution when the node did not pick one, so the quote and the send agree', () => {
    expect(discountRouteFor({ candidate: banana, health: RouteHealth.Healthy, params: {}, primaryUsd: null })?.params).toEqual({ resolution: '1K' });
  });

  it('keeps the primary for a resolution kie does not price', () => {
    expect(discountRouteFor({ candidate: banana, health: RouteHealth.Healthy, params: { resolution: '4K' }, primaryUsd: 0.15 })).toBeNull();
  });

  it('keeps the primary when kie is not cheaper', () => {
    expect(discountRouteFor({ candidate: banana, health: RouteHealth.Healthy, params: { resolution: '1K' }, primaryUsd: 0.03 })).toBeNull();
  });

  it('keeps the primary while kie is demoted', () => {
    expect(discountRouteFor({ candidate: banana, health: RouteHealth.Demoted, params: { resolution: '1K' }, primaryUsd: 0.1 })).toBeNull();
  });
});

const ok = (ms: number): CallSample => ({ ok: true, ms });
const bad: CallSample = { ok: false, ms: 1000 };

describe('routeHealthOf — demotes kie from what ai_calls says it did', () => {
  it('trusts kie until there are enough calls to judge', () => {
    expect(routeHealthOf('image', [bad, bad])).toBe(RouteHealth.Healthy);
  });

  it('demotes below 95% success, the line kie crossed at 3.5% failures before', () => {
    const samples = [...Array.from({ length: 18 }, () => ok(5000)), bad, bad];
    expect(routeHealthOf('image', samples)).toBe(RouteHealth.Demoted);
  });

  it('demotes when the image p95 passes two minutes, kie\'s old 142.9 s', () => {
    const samples = [...Array.from({ length: 18 }, () => ok(5000)), ok(142_900), ok(150_000)];
    expect(routeHealthOf('image', samples)).toBe(RouteHealth.Demoted);
  });

  it('keeps kie healthy when it delivers', () => {
    expect(routeHealthOf('image', Array.from({ length: 30 }, () => ok(12_000)))).toBe(RouteHealth.Healthy);
  });
});
