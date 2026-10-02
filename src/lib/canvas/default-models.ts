export type GenerativeMedium = 'text' | 'image' | 'video' | 'audio' | 'model3d';

import { TIER_ORDER, type RecommendationTier } from './recommended-models';
import { DEFAULT_AUDIO_OPERATION, defaultAudioModel } from './audio-operations';
import { DEFAULT_MODEL3D_MODEL } from '$lib/model3d-models';

export type ModelChoiceLike = { id: string; tiers?: readonly RecommendationTier[] };

const MEDIUM_PHRASE: Record<GenerativeMedium, string> = {
  text: 'a text',
  image: 'an image',
  video: 'a video',
  audio: 'an audio',
  model3d: 'a 3D model'
};

export const DEFAULT_MODEL: Record<GenerativeMedium, string> = {
  text: 'anthropic/claude-haiku-4.5',
  image: 'nano-banana-2',
  video: 'bytedance/seedance-2-fast',
  audio: defaultAudioModel(DEFAULT_AUDIO_OPERATION),
  model3d: DEFAULT_MODEL3D_MODEL
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

export type OfferedModels = {
  choices: readonly ModelChoiceLike[];
  recommended: readonly { tier: RecommendationTier; id: string }[];
};

export type ModelPick = { ok: true; model: string } | { ok: false; error: string };

const SUGGESTION_ORDER: readonly RecommendationTier[] = ['balanced', ...TIER_ORDER.filter((tier) => tier !== 'balanced')];
const MAX_PLAIN_SUGGESTIONS = 5;

function suggestions(offered: OfferedModels): string {
  const tiered = SUGGESTION_ORDER.flatMap((tier) =>
    offered.recommended.filter((r) => r.tier === tier).map((r) => `${r.id} (${tier})`)
  );
  if (tiered.length) {
    return tiered.join(', ');
  }
  return offered.choices.slice(0, MAX_PLAIN_SUGGESTIONS).map((c) => c.id).join(', ');
}

function isOffered(model: string, offered: OfferedModels): boolean {
  return offered.choices.some((c) => c.id === model) || offered.recommended.some((r) => r.id === model);
}

function cannotJudge(offered: OfferedModels): boolean {
  return !offered.choices.length && !offered.recommended.length;
}

export function pickModel(medium: GenerativeMedium, explicit: string | null | undefined, offered: OfferedModels): ModelPick {
  if (!explicit) {
    const model = offered.recommended.find((r) => r.tier === 'balanced')?.id ?? effectiveModel(medium, null, offered.choices);
    return model ? { ok: true, model } : { ok: false, error: 'model_required' };
  }

  if (cannotJudge(offered) || isOffered(explicit, offered)) {
    return { ok: true, model: explicit };
  }

  return {
    ok: false,
    error: `unknown_model: "${explicit}" is not ${MEDIUM_PHRASE[medium]} model the canvas offers. Recommended: ${suggestions(offered)}.`
  };
}
