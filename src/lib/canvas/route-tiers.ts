import { creditsForRun } from './gen-cost';
import type { GenMedium, GenParams, ModelChoice } from './gen-node';

export enum PriceTier {
  Low = '$',
  Mid = '$$',
  High = '$$$'
}

const TIER_CEILINGS: ReadonlyArray<readonly [ratio: number, tier: PriceTier]> = [
  [1.25, PriceTier.Low],
  [2.5, PriceTier.Mid]
];

function tierOf(credits: number, cheapest: number): PriceTier {
  const ratio = cheapest > 0 ? credits / cheapest : 1;
  return TIER_CEILINGS.find(([ceiling]) => ratio < ceiling)?.[1] ?? PriceTier.High;
}

export function routeTiers(choice: ModelChoice, medium: GenMedium, params: GenParams): Record<string, PriceTier> {
  const priced = (choice.routes ?? []).flatMap((route) => {
    const credits = creditsForRun({ medium, model: choice, params: { ...params, provider: route.provider } });
    return credits === null ? [] : [{ provider: route.provider, credits }];
  });
  const cheapest = Math.min(...priced.map((entry) => entry.credits));
  return Object.fromEntries(priced.map((entry) => [entry.provider, tierOf(entry.credits, cheapest)]));
}
