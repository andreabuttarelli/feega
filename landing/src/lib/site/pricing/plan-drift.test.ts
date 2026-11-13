import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FREE_EDITORS, PLAN } from './plan';

const APP_LADDER = readFileSync(new URL('../../../../../src/lib/credit-ladder.ts', import.meta.url), 'utf8');

const appNumber = (pattern: RegExp): number => Number(APP_LADDER.match(pattern)?.[1]);

describe('the landing quotes the plan the app sells', () => {
  it('matches price, included credits, free editors and the agent cap', () => {
    expect(appNumber(/export const PLAN: Plan = \{ price: (\d+)/)).toBe(PLAN.price);
    expect(appNumber(/export const PLAN: Plan = \{ price: \d+, credits: (\d+)/)).toBe(PLAN.includedCredits);
    expect(appNumber(/export const FREE_EDITOR_SEATS = (\d+)/)).toBe(FREE_EDITORS);
    expect(appNumber(/export const FREE_AGENT_LAYERS_PER_WEEK = (\d+)/)).toBe(PLAN.freeAgentLayersPerWeek);
  });

  it('matches the top-up prices and their credits', () => {
    const prices = APP_LADDER.match(/export const TOP_UPS[^=]*= \[([\d, ]+)\]/)?.[1].split(',').map(Number);
    const perEuro = appNumber(/export const CREDITS_PER_USD_GRANT = (\d+)/);
    expect(prices?.map((price) => ({ price, credits: price * perEuro }))).toEqual(PLAN.topUps);
  });
});
