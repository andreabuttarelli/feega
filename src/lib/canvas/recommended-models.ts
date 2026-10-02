import type { GenerativeMedium } from './default-models';

export type RecommendationTier = 'best' | 'balanced' | 'cheapest-good';

export type CandidateModel = {
  id: string;
  label: string;
  releasedAt: string | null;
  expiresAt: string | null;
  unitCostUsd: number | null;
  benchmark: number | null;
  capability: number;
};

export type Recommendation = {
  tier: RecommendationTier;
  id: string;
  label: string;
  unitCostUsd: number;
  releasedAt: string;
  why: string;
};

export type ExclusionRow = { medium: GenerativeMedium; pattern: RegExp; reason: string };

export const RECOMMENDATION_EXCLUSIONS: readonly ExclusionRow[] = [
  { medium: 'text', pattern: /:free$/, reason: 'free variants are rate-limited and drop requests' },
  { medium: 'text', pattern: /^openrouter\//, reason: 'a router that picks another model, not a model' },
  { medium: 'text', pattern: /:batch$/, reason: 'batch pricing: answers arrive hours later, not on the canvas' },
  { medium: 'image', pattern: /-vector$/, reason: 'returns SVG vector art, not a picture for a post' },
  { medium: 'video', pattern: /flux-video-upscale$/, reason: 'upscales an existing clip, cannot generate one' },
  { medium: 'video', pattern: /flux-video-edit$/, reason: 'edits an existing clip, cannot generate one' },
  { medium: 'video', pattern: /^runway\/aleph/, reason: 'video-to-video editor, needs a source clip' },
  { medium: 'video', pattern: /^heygen\//, reason: 'talking-avatar renderer, not a general video model' }
];

type Weights = { recency: number; benchmark: number; capability: number; priceTier: number };

const QUALITY_WEIGHTS: Record<GenerativeMedium, Weights> = {
  text: { recency: 0.3, benchmark: 0.5, capability: 0.1, priceTier: 0.1 },
  image: { recency: 0.6, benchmark: 0, capability: 0.2, priceTier: 0.2 },
  video: { recency: 0.6, benchmark: 0, capability: 0.2, priceTier: 0.2 },
  audio: { recency: 0.6, benchmark: 0, capability: 0.2, priceTier: 0.2 },
  model3d: { recency: 0.4, benchmark: 0, capability: 0.2, priceTier: 0.4 }
};

const COST_UNIT: Record<GenerativeMedium, string> = {
  text: 'M output tokens',
  image: 'image',
  video: 'second',
  audio: 'second',
  model3d: 'model'
};

const RECENCY_HORIZON_MONTHS = 24;
const QUALITY_FLOOR = 0.8;
const BALANCED_COST_PENALTY = 0.25;
const OLD_MODEL_MONTHS = 12;
const WEAK_MODEL_RATIO = 0.6;
const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000;
export const TIER_ORDER: readonly RecommendationTier[] = ['best', 'balanced', 'cheapest-good'];

type Scored = CandidateModel & { unitCostUsd: number; releasedAt: string; quality: number; costRank: number };

function ageMonths(releasedAt: string, now: Date): number {
  return (now.getTime() - Date.parse(releasedAt)) / MS_PER_MONTH;
}

function isExcluded(medium: GenerativeMedium, id: string): boolean {
  return RECOMMENDATION_EXCLUSIONS.some((row) => row.medium === medium && row.pattern.test(id));
}

function isEligible(medium: GenerativeMedium, model: CandidateModel, now: Date): boolean {
  if (isExcluded(medium, model.id)) {
    return false;
  }
  if (model.expiresAt && Date.parse(model.expiresAt) <= now.getTime()) {
    return false;
  }
  return !!model.releasedAt && (model.unitCostUsd ?? 0) > 0;
}

function rankOf(value: number, min: number, max: number): number {
  return max > min ? (value - min) / (max - min) : 0;
}

function medianOf(values: number[]): number | null {
  if (!values.length) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function score(medium: GenerativeMedium, candidates: readonly CandidateModel[], now: Date): Scored[] {
  const eligible = candidates.filter((m) => isEligible(medium, m, now)) as Array<
    CandidateModel & { unitCostUsd: number; releasedAt: string }
  >;
  if (!eligible.length) {
    return [];
  }

  const logCosts = eligible.map((m) => Math.log(m.unitCostUsd));
  const minLogCost = Math.min(...logCosts);
  const maxLogCost = Math.max(...logCosts);
  const maxBenchmark = Math.max(0, ...eligible.map((m) => m.benchmark ?? 0));
  const unbenchmarked = medianOf(eligible.flatMap((m) => (m.benchmark !== null && maxBenchmark > 0 ? [m.benchmark / maxBenchmark] : [])));
  const maxCapability = Math.max(0, ...eligible.map((m) => Math.log1p(m.capability)));
  const weights = QUALITY_WEIGHTS[medium];

  return eligible.map((m, i) => {
    const recency = Math.min(1, Math.max(0, 1 - ageMonths(m.releasedAt, now) / RECENCY_HORIZON_MONTHS));
    const benchmark = m.benchmark !== null && maxBenchmark > 0 ? m.benchmark / maxBenchmark : unbenchmarked ?? recency;
    const capability = maxCapability > 0 ? Math.log1p(m.capability) / maxCapability : 0;
    const costRank = rankOf(logCosts[i], minLogCost, maxLogCost);
    const quality =
      weights.recency * recency +
      weights.benchmark * benchmark +
      weights.capability * capability +
      weights.priceTier * costRank;
    return { ...m, quality, costRank };
  });
}

function pickBest(scored: Scored[]): Scored {
  return scored.reduce((a, b) => (b.quality > a.quality ? b : a));
}

function pickTiers(scored: Scored[]): Record<RecommendationTier, Scored> {
  const best = pickBest(scored);
  const good = scored.filter((m) => m.quality >= QUALITY_FLOOR * best.quality);
  const value = (m: Scored) => m.quality - BALANCED_COST_PENALTY * m.costRank;
  const balanced = good.reduce((a, b) => (value(b) > value(a) ? b : a));
  const cheapest = good.reduce((a, b) =>
    b.unitCostUsd < a.unitCostUsd || (b.unitCostUsd === a.unitCostUsd && b.quality > a.quality) ? b : a
  );
  return { best, balanced, 'cheapest-good': cheapest };
}

function whyOf(medium: GenerativeMedium, m: Scored): string {
  return `$${m.unitCostUsd.toFixed(3)}/${COST_UNIT[medium]} · released ${m.releasedAt.slice(0, 7)}`;
}

export function recommend(
  medium: GenerativeMedium,
  candidates: readonly CandidateModel[],
  now: Date
): Recommendation[] {
  const scored = score(medium, candidates, now);
  if (!scored.length) {
    return [];
  }

  const tiers = pickTiers(scored);
  return TIER_ORDER.map((tier) => ({
    tier,
    id: tiers[tier].id,
    label: tiers[tier].label,
    unitCostUsd: tiers[tier].unitCostUsd,
    releasedAt: tiers[tier].releasedAt,
    why: whyOf(medium, tiers[tier])
  }));
}

export function modelAdvice(
  medium: GenerativeMedium,
  modelId: string,
  candidates: readonly CandidateModel[],
  now: Date
): string | null {
  const scored = score(medium, candidates, now);
  const chosen = scored.find((m) => m.id === modelId);
  if (!chosen) {
    return null;
  }

  const tiers = pickTiers(scored);
  if (TIER_ORDER.some((tier) => tiers[tier].id === modelId)) {
    return null;
  }

  const old = ageMonths(chosen.releasedAt, now) > OLD_MODEL_MONTHS;
  const weak = chosen.quality < WEAK_MODEL_RATIO * tiers.best.quality;
  if (!old && !weak) {
    return null;
  }

  const balanced = tiers.balanced;
  const reason = old ? `was released ${chosen.releasedAt.slice(0, 7)}` : 'scores far below current models';
  return `${chosen.label} (${chosen.id}) ${reason}; the recommended ${medium} model is ${balanced.label} (${balanced.id}, ${whyOf(medium, balanced)}).`;
}

type OfferedChoice = { id: string; label: string; wireId?: string };

export type Recommended<C extends OfferedChoice> = {
  choices: Array<C & { tiers?: RecommendationTier[]; recommendedWhy?: string }>;
  recommended: Recommendation[];
  candidates: CandidateModel[];
};

export function withRecommendations<C extends OfferedChoice>(
  medium: GenerativeMedium,
  choices: readonly C[],
  synced: readonly CandidateModel[],
  now: Date
): Recommended<C> {
  const byWireId = new Map(synced.map((row) => [row.id, row]));
  const candidates = choices.flatMap((choice) => {
    const row = byWireId.get(choice.wireId ?? choice.id);
    return row ? [{ ...row, id: choice.id, label: choice.label }] : [];
  });

  const recommended = recommend(medium, candidates, now);
  const tagged = choices.map((choice) => {
    const tiers = recommended.filter((r) => r.id === choice.id);
    if (!tiers.length) {
      return choice;
    }
    return { ...choice, tiers: tiers.map((r) => r.tier), recommendedWhy: tiers[0].why };
  });

  return { choices: tagged, recommended, candidates };
}
