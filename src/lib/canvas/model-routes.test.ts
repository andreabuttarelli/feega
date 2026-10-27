import { describe, expect, it } from 'vitest';
import type { ModelChoice } from './gen-node';
import { creditsForRun } from './gen-cost';
import { AUTO_ROUTE, routeStatsLabel } from './model-routes';

const banana: ModelChoice = {
  id: 'nano-banana-2',
  label: 'Nano Banana 2',
  aspectRatios: ['1:1'],
  provider: 'google',
  providerLabel: 'Google',
  pricedInputs: [{ inputs: { resolution: '' }, credits: 8 }],
  routes: [
    { provider: AUTO_ROUTE, label: 'Auto (cheapest healthy)', price: { pricedInputs: [{ inputs: { resolution: '' }, credits: 8 }] }, stats: null },
    { provider: 'openrouter', label: 'OpenRouter', price: { unitCredits: 10 }, stats: null },
    { provider: 'kie', label: 'Kie.ai', price: { pricedInputs: [{ inputs: { resolution: '' }, credits: 8 }] }, stats: { successRate: 0.99, p95Ms: 14_000, healthy: true } }
  ]
};

const soul: ModelChoice = { id: 'higgsfield/higgsfield-ai/soul/standard', label: 'Higgsfield Soul', aspectRatios: ['1:1'], provider: 'higgsfield', providerLabel: 'Higgsfield', unitCredits: 19 };

describe('each provider row says how reliable and fast it has been', () => {
  it('names success rate and p95 for a provider with history, and warns when it is demoted', () => {
    expect(routeStatsLabel(banana.routes![2])).toBe('99% success · ~14 s');
    expect(routeStatsLabel({ ...banana.routes![2], stats: { successRate: 0.8, p95Ms: 150_000, healthy: false } })).toBe('Unreliable now: 80% success · ~150 s. Auto skips it');
  });

  it('describes Auto, and says nothing about a provider without history', () => {
    expect(routeStatsLabel(banana.routes![0])).toBe('Cheapest healthy provider, falls back if it fails');
    expect(routeStatsLabel(banana.routes![1])).toBeNull();
  });
});

describe('the price shown follows the provider saved on the node', () => {
  it('Auto and kie show the kie price, OpenRouter shows its own', () => {
    expect(creditsForRun({ medium: 'image', model: banana, params: {} })).toBe(8);
    expect(creditsForRun({ medium: 'image', model: banana, params: { provider: 'kie' } })).toBe(8);
    expect(creditsForRun({ medium: 'image', model: banana, params: { provider: 'openrouter' } })).toBe(10);
  });
});
