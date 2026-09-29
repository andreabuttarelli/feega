import type { ModelChoice } from './gen-node';
import { TIER_ORDER, type RecommendationTier } from './recommended-models';

export function filterChoices(choices: ModelChoice[], query: string): ModelChoice[] {
  const q = query.trim().toLowerCase();
  if (!q) return choices;
  return choices.filter(
    (c) => c.label.toLowerCase().includes(q) || c.providerLabel.toLowerCase().includes(q)
  );
}

export type ProviderGroup = { provider: string; providerLabel: string; choices: ModelChoice[] };

export function groupByProvider(choices: ModelChoice[]): ProviderGroup[] {
  const order: string[] = [];
  const groups = new Map<string, ProviderGroup>();

  for (const choice of choices) {
    if (!groups.has(choice.provider)) {
      order.push(choice.provider);
      groups.set(choice.provider, { provider: choice.provider, providerLabel: choice.providerLabel, choices: [] });
    }
    groups.get(choice.provider)!.choices.push(choice);
  }

  return order.map((key) => groups.get(key)!);
}

function firstTierIndex(choice: ModelChoice): number {
  return Math.min(...(choice.tiers ?? []).map((tier) => TIER_ORDER.indexOf(tier)));
}

export function recommendedFirst(choices: ModelChoice[]): ModelChoice[] {
  return choices.filter((c) => c.tiers?.length).sort((a, b) => firstTierIndex(a) - firstTierIndex(b));
}

export const RECOMMENDED_GROUP = 'recommended';

export const TIER_LABEL: Record<RecommendationTier, string> = {
  best: 'Best',
  balanced: 'Balanced',
  'cheapest-good': 'Best value'
};

export type ModelMenuGroup = { id: string; label: string; items: { value: string; label: string; keywords: string }[] };

function itemsOf(choices: ModelChoice[]): ModelMenuGroup['items'] {
  return choices.map((c) => ({ value: c.id, label: c.label, keywords: c.providerLabel }));
}

export function modelGroupsOf(choices: ModelChoice[]): ModelMenuGroup[] {
  const recommended = recommendedFirst(choices);
  const head = recommended.length ? [{ id: RECOMMENDED_GROUP, label: 'Recommended', items: itemsOf(recommended) }] : [];
  const providers = groupByProvider(choices).map((g) => ({ id: g.provider, label: g.providerLabel, items: itemsOf(g.choices) }));

  return [...head, ...providers];
}
