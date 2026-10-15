import { describe, expect, it, vi } from 'vitest';
import type { ModelChoice } from '$lib/canvas/gen-node';
import { creditsForRun } from '$lib/canvas/gen-cost';
import { billedCreditsFor } from '$lib/credit-ladder';
import { kie } from '../kie';
import { KIE_SUCCESS } from '../kie.fixtures';
import { kieModelRows } from '../kie-catalogue';
import { discountCandidateOf, RouteHealth, type DiscountCandidate } from './discount-route';
import { routeFor, withDiscountPrices, type DiscountBook } from './discount-routes';
import { TaskProviderName } from './task-providers';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

const candidates = new Map(
  kieModelRows('2026-10-15T00:00:00.000Z')
    .map(discountCandidateOf)
    .filter((c): c is DiscountCandidate => c !== null)
    .map((c) => [c.discountFor, c])
);

const book = (health = RouteHealth.Healthy): DiscountBook => ({ provider: TaskProviderName.Kie, candidates, health });

const nanoBanana2: ModelChoice = {
  id: 'nano-banana-2',
  label: 'Nano Banana 2',
  aspectRatios: ['1:1'],
  provider: 'google',
  providerLabel: 'Google',
  resolutions: ['512', '1K', '2K', '4K'],
  variableCredits: true
};

async function kieChargedCredits(creditsConsumed: number): Promise<number> {
  const reply = { ...KIE_SUCCESS, data: { ...KIE_SUCCESS.data, creditsConsumed } };
  const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify(reply)));
  const task = await kie({ apiKey: 'k', fetchFn: fetchFn as unknown as typeof fetch }).task('task_1');
  if (task.state !== 'done' || task.costUsd === null) {
    throw new Error('fixture did not finish');
  }
  return billedCreditsFor(task.costUsd);
}

describe('the price the picker shows is the price the route that runs charges', () => {
  it('kie route, default resolution: shown credits equal what kie bills for the same render', async () => {
    const shown = creditsForRun({ medium: 'image', model: withDiscountPrices(book(), nanoBanana2, 'image'), params: {} });

    expect(shown).toBe(await kieChargedCredits(8));
  });

  it('kie route, 2K: shown credits equal what kie bills at 2K', async () => {
    const shown = creditsForRun({ medium: 'image', model: withDiscountPrices(book(), nanoBanana2, 'image'), params: { resolution: '2K' } });

    expect(shown).toBe(await kieChargedCredits(12));
  });

  it('primary route for a resolution kie does not price: no kie number is shown for it', () => {
    const choice = withDiscountPrices(book(), nanoBanana2, 'image');

    expect(routeFor(book(), nanoBanana2, 'image', { resolution: '4K' })).toBeNull();
    expect(creditsForRun({ medium: 'image', model: choice, params: { resolution: '4K' } })).toBeNull();
  });

  it('kie demoted: the choice keeps the primary price untouched and names no discount', () => {
    expect(withDiscountPrices(book(RouteHealth.Demoted), nanoBanana2, 'image')).toBe(nanoBanana2);
  });

  it('marks the choice with the route that will be tried first', () => {
    expect(withDiscountPrices(book(), nanoBanana2, 'image').discountRoute).toEqual({ provider: 'kie', label: 'kie.ai' });
  });
});
