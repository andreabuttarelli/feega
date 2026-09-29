export type GenerativeMedium = 'text' | 'image' | 'video';

import type { RecommendationTier } from './recommended-models';

export type ModelChoiceLike = { id: string; tiers?: readonly RecommendationTier[] };

export const DEFAULT_MODEL: Record<GenerativeMedium, string> = {
  text: 'anthropic/claude-haiku-4.5',
  image: 'nano-banana-2',
  video: 'bytedance/seedance-2-fast'
};

export function effectiveModel(
  medium: GenerativeMedium,
  saved: string | null | undefined,
  choices: readonly ModelChoiceLike[]
): string | null {
  if (saved) {
    return saved;
  }
  const balanced = choices.find((c) => c.tiers?.includes('balanced'));
  if (balanced) {
    return balanced.id;
  }
  if (choices.some((c) => c.id === DEFAULT_MODEL[medium])) {
    return DEFAULT_MODEL[medium];
  }
  return choices[0]?.id ?? null;
}
