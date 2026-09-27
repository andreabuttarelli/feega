import type { GenMedium, GenParams, ModelChoice } from './gen-node';

export type RunCostInput = {
  medium: GenMedium;
  model: ModelChoice | null;
  params: GenParams;
  prompt?: string;
  textInputTokens?: number;
  /** Il prezzo di UNA riscrittura (`prompt-enhance.ts`, un giro del modello di craft), dallo
   *  stesso listino di `content-cost.ts::TEXT_NODE_CREDITS` — mandato dal catalogo perché il
   *  client non ha (e non deve avere) le tariffe. Assente = costo ignoto: si aggiunge zero, mai
   *  un numero inventato. */
  enhanceUnitCredits?: number;
};

const CHARS_PER_TOKEN = 4;
const TOKENS_PER_MILLION = 1_000_000;
const MIN_OUTPUT_TOKENS = 32;
const MAX_OUTPUT_TOKENS = 8192;

export function tokenCount(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function textOutputTokens(inputTokens: number, ratio = 1): number {
  return Math.min(MAX_OUTPUT_TOKENS, Math.max(MIN_OUTPUT_TOKENS, Math.round(inputTokens * ratio)));
}

function textCredits(input: RunCostInput): number | null {
  const pricing = input.model?.textPricing;
  if (!pricing || typeof pricing.estimatedOutputTokens !== 'number') {
    return null;
  }

  const userPromptTokens = tokenCount(input.prompt ?? '');
  const inputTokens = input.textInputTokens ?? pricing.systemPromptTokens + userPromptTokens;
  const credits =
    inputTokens * pricing.inputCreditsPerMillion +
    pricing.estimatedOutputTokens * pricing.outputCreditsPerMillion;

  return Math.round(credits / TOKENS_PER_MILLION);
}

const RESOLUTION_MULTIPLIERS: Record<string, number> = {
  '480p': 1,
  '720p': 2
};

export function creditsForRun(input: RunCostInput): number | null {
  if (input.medium === 'text') {
    return textCredits(input);
  }

  let unit = input.model?.unitCredits;

  for (const [name, values] of Object.entries(input.model?.creditOverrides ?? {})) {
    const value = (input.params as Record<string, unknown>)[name];
    const override = typeof value === 'string' ? values[value] : undefined;
    if (typeof override === 'number') {
      unit = override;
    }
  }

  if (typeof unit !== 'number') {
    return null;
  }

  const enhanceExtra =
    input.params.enhancePrompt && typeof input.enhanceUnitCredits === 'number'
      ? input.enhanceUnitCredits
      : 0;

  if (input.medium !== 'video') {
    return unit + enhanceExtra;
  }

  const resolution = input.params.resolution;
  const resolutionMultiplier = resolution ? RESOLUTION_MULTIPLIERS[resolution] : 1;
  if (resolutionMultiplier === undefined) {
    return null;
  }

  const base = input.model?.minDuration;
  const duration = input.params.duration;
  if (typeof base !== 'number' || base <= 0 || typeof duration !== 'number' || duration <= 0) {
    return Math.round(unit * resolutionMultiplier) + enhanceExtra;
  }

  return Math.round(unit * (duration / base) * resolutionMultiplier) + enhanceExtra;
}

/** Il totale di un loop di `count` giri identici — `null` appena il prezzo di uno solo lo è. */
export function creditsForLoop(input: RunCostInput, count: number): number | null {
  const perRun = creditsForRun(input);
  if (perRun === null) {
    return null;
  }
  return perRun * Math.max(0, Math.round(count));
}
