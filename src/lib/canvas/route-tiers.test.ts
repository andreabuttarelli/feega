import { describe, expect, it } from 'vitest';
import type { ModelChoice } from './gen-node';
import { PriceTier, routeTiers } from './route-tiers';

const route = (provider: string, unitCredits: number) => ({ provider, label: provider, price: { unitCredits }, stats: null });

const choice: ModelChoice = {
  id: 'nano-banana-2',
  label: 'Nano Banana 2',
  aspectRatios: ['1:1'],
  provider: 'google',
  providerLabel: 'Google',
  routes: [route('auto', 5), route('openrouter', 12), route('kie', 5)]
};

describe('the rough price of each route, relative to the model’s cheapest', () => {
  it('marks the cheapest route $, a dearer one $$ and one far dearer $$$', () => {
    const far = { ...choice, routes: [...choice.routes!, route('other', 30)] };

    expect(routeTiers(far, 'image', {})).toEqual({ auto: PriceTier.Low, openrouter: PriceTier.Mid, kie: PriceTier.Low, other: PriceTier.High });
  });

  it('follows the node settings, not a list minimum', () => {
    const byResolution = { ...choice, routes: [route('auto', 5), { ...route('openrouter', 0), price: { creditOverrides: { resolution: { '1K': 5 } }, unitCredits: 5 } }, route('kie', 9)] };

    expect(routeTiers(byResolution, 'image', { resolution: '1K' })).toMatchObject({ openrouter: PriceTier.Low, kie: PriceTier.Mid });
  });

  it('leaves a route it cannot price unmarked', () => {
    const unpriced = { ...choice, routes: [route('auto', 5), { ...route('openrouter', 0), price: {} }, route('kie', 5)] };

    expect(routeTiers(unpriced, 'image', {}).openrouter).toBeUndefined();
  });
});
