import { snapResolution, VideoAudio, type GenMedium, type GenParams, type ModelChoice } from './gen-node';
import { pricedFor } from './model-routes';
import { audioCreditsFor, audioDurationOf, audioModelFor, audioOperationOf } from './audio-operations';

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

function audioCredits(input: RunCostInput): number | null {
  const operation = audioOperationOf(input.params);
  const model = audioModelFor(operation, input.model?.id);
  const seconds = audioDurationOf(operation, input.params);
  return audioCreditsFor(operation, model, { characters: input.prompt?.length ?? 0, seconds: seconds ?? undefined });
}

function pricedCredits(input: RunCostInput): number | null {
  const params = input.params as Record<string, unknown>;
  const line = input.model?.pricedInputs?.find((l) => Object.entries(l.inputs).every(([k, v]) => String(params[k] ?? '') === v));
  if (!line) {
    return null;
  }
  const enhanceExtra = input.params.enhancePrompt && typeof input.enhanceUnitCredits === 'number' ? input.enhanceUnitCredits : 0;
  return line.credits + enhanceExtra;
}

export function listedCredits(choice: ModelChoice): number | undefined {
  const rates = Object.values(choice.perSecondCredits ?? {}).flatMap((byResolution) => Object.values(byResolution ?? {}));
  if (rates.length) {
    return Math.round(Math.min(...rates) * (choice.minDuration ?? 1));
  }
  if (typeof choice.unitCredits === 'number') {
    return choice.unitCredits;
  }
  const priced = choice.pricedInputs?.map((line) => line.credits) ?? [];
  return priced.length ? Math.min(...priced) : undefined;
}

function enhanceCredits(input: RunCostInput): number {
  return input.params.enhancePrompt && typeof input.enhanceUnitCredits === 'number' ? input.enhanceUnitCredits : 0;
}

function perSecondRunCredits(input: RunCostInput, model: ModelChoice): number | null {
  const audio = (input.params.audio ?? model.generateAudio) ? VideoAudio.With : VideoAudio.Without;
  const rates = model.perSecondCredits?.[audio] ?? model.perSecondCredits?.[VideoAudio.With] ?? model.perSecondCredits?.[VideoAudio.Without];
  const resolution = snapResolution(model, input.params.resolution);
  const perSecond = resolution ? rates?.[resolution] : undefined;
  const seconds = input.params.duration ?? model.minDuration;
  if (perSecond === undefined || typeof seconds !== 'number') {
    return null;
  }
  return Math.round(perSecond * seconds) + enhanceCredits(input);
}

function withResolution(params: GenParams, model: ModelChoice | null): GenParams {
  const resolution = model ? snapResolution(model, params.resolution) : params.resolution;
  return resolution ? { ...params, resolution } : params;
}

export function creditsForRun(raw: RunCostInput): number | null {
  const input = { ...raw, params: withResolution(raw.params, raw.model), model: pricedFor(raw.model, raw.params) };
  if (input.model?.perSecondCredits) {
    return perSecondRunCredits(input, input.model);
  }
  if (input.model?.pricedInputs) {
    return pricedCredits(input);
  }
  if (input.medium === 'text') {
    return textCredits(input);
  }
  if (input.medium === 'audio') {
    return audioCredits(input);
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
