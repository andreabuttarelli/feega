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

  it('kie demoted: Auto keeps the primary price and names no discount', () => {
    const choice = withDiscountPrices(book(RouteHealth.Demoted), nanoBanana2, 'image');
    expect(choice.discountRoute).toBeUndefined();
    expect(choice.variableCredits).toBe(true);
  });

  it('offers Auto, OpenRouter and kie.ai as separate rows, each with its own price', () => {
    const choice = withDiscountPrices(book(), { ...nanoBanana2, unitCredits: 13, variableCredits: false }, 'image');

    expect(choice.routes?.map((r) => r.provider)).toEqual(['auto', 'openrouter', 'kie']);
    expect(creditsForRun({ medium: 'image', model: choice, params: { provider: 'openrouter' } })).toBe(13);
    expect(creditsForRun({ medium: 'image', model: choice, params: { provider: 'kie', resolution: '2K' } })).toBe(billedCreditsFor(0.06));
    expect(choice.routes?.find((r) => r.provider === 'kie')?.stats).toMatchObject({ healthy: true });
  });

  it('a demoted kie stays pickable by hand, flagged, while Auto falls back to the primary price', () => {
    const choice = withDiscountPrices(book(RouteHealth.Demoted), { ...nanoBanana2, unitCredits: 13, variableCredits: false }, 'image');

    expect(choice.routes?.find((r) => r.provider === 'kie')?.stats).toMatchObject({ healthy: false });
    expect(creditsForRun({ medium: 'image', model: choice, params: {} })).toBe(13);
    expect(creditsForRun({ medium: 'image', model: choice, params: { provider: 'kie' } })).toBe(billedCreditsFor(0.04));
  });

  it('a chosen provider routes there even when Auto would not', () => {
    expect(routeFor(book(RouteHealth.Demoted), nanoBanana2, 'image', { provider: 'kie' })?.modelId).toBe('kie/nano-banana-2');
    expect(routeFor(book(), nanoBanana2, 'image', { provider: 'openrouter' })).toBeNull();
  });

  it('marks the choice with the route that will be tried first', () => {
    expect(withDiscountPrices(book(), nanoBanana2, 'image').discountRoute).toEqual({ provider: 'kie', label: 'kie.ai' });
  });
});
