import type { UpscaleLimits } from '$lib/video-models';
import { billedCreditsFor } from '$lib/credit-ladder';

export enum UpscaleTarget {
  Double = '2x',
  FourK = '4k'
}

export enum UpscaleMode {
  Precise = 'precise',
  Creative = 'creative'
}

export type UpscaleSource = { width: number; height: number; seconds: number; bytes: number; mimeType: string };

export type UpscaleRefusal =
  | 'unreadable_video'
  | 'format_not_supported'
  | 'too_long'
  | 'too_large'
  | 'resolution_too_high';

export type UpscalePlan = { ok: true; factor: number; width: number; height: number } | { ok: false; error: UpscaleRefusal };

export type UpscaleQuote = { usd: number | null; credits: number | null };

const FOUR_K_LONG_EDGE = 3840;
const PIXELS_PER_MEGAPIXEL = 1_000_000;
const CENTS_PER_USD = 100;
const FACTOR_DECIMALS = 100;

export const UPSCALE_TARGETS: readonly { id: UpscaleTarget; label: string }[] = [
  { id: UpscaleTarget.Double, label: '2×' },
  { id: UpscaleTarget.FourK, label: '4K' }
];

export const UPSCALE_MODES: readonly { id: UpscaleMode; label: string; hint: string }[] = [
  { id: UpscaleMode.Precise, label: 'Precise', hint: 'Faces, products, text: keeps every detail as filmed.' },
  { id: UpscaleMode.Creative, label: 'Creative', hint: 'Scenery, textures, AI clips: restores and invents finer detail.' }
];

export const UPSCALE_REFUSAL_TEXT: Record<UpscaleRefusal, string> = {
  unreadable_video: 'This video could not be read.',
  format_not_supported: 'Upload an MP4 video.',
  too_long: 'The clip is too long: trim it to 20 seconds or less.',
  too_large: 'The file is too large: 50 MB at most.',
  resolution_too_high: 'The clip is already above 1440p: nothing to upscale.'
};

const PRICE_SKU: Record<UpscaleMode, string> = {
  [UpscaleMode.Precise]: 'cents_per_megapixel_second_precise',
  [UpscaleMode.Creative]: 'cents_per_megapixel_second_creative'
};

const CREATIVITY: Record<UpscaleMode, number> = {
  [UpscaleMode.Precise]: 0,
  [UpscaleMode.Creative]: 1
};

const WANTED_FACTOR: Record<UpscaleTarget, (source: UpscaleSource) => number> = {
  [UpscaleTarget.Double]: () => 2,
  [UpscaleTarget.FourK]: (source) => FOUR_K_LONG_EDGE / Math.max(source.width, source.height)
};

function refusalOf(source: UpscaleSource, limits: UpscaleLimits): UpscaleRefusal | null {
  const longEdge = Math.max(source.width, source.height);
  const shortEdge = Math.min(source.width, source.height);
  const checks: [boolean, UpscaleRefusal][] = [
    [!(source.seconds > 0 && shortEdge > 0), 'unreadable_video'],
    [!limits.inputMimeTypes.includes(source.mimeType), 'format_not_supported'],
    [source.seconds > limits.maxInputSeconds, 'too_long'],
    [source.bytes > limits.maxInputBytes, 'too_large'],
    [longEdge > limits.maxInputLongEdge || shortEdge > limits.maxInputShortEdge, 'resolution_too_high']
  ];
  return checks.find(([failed]) => failed)?.[1] ?? null;
}

function floorTo(value: number, step: number): number {
  return Math.floor(value * step) / step;
}

export function planUpscale(source: UpscaleSource, target: UpscaleTarget, limits: UpscaleLimits): UpscalePlan {
  const refusal = refusalOf(source, limits);
  if (refusal) {
    return { ok: false, error: refusal };
  }

  const frameCap = Math.sqrt((limits.maxOutputMegapixels * PIXELS_PER_MEGAPIXEL) / (source.width * source.height));
  const wanted = Math.min(WANTED_FACTOR[target](source), limits.maxFactor, frameCap);
  const factor = floorTo(Math.max(wanted, limits.minFactor), FACTOR_DECIMALS);

  return { ok: true, factor, width: Math.round(source.width * factor), height: Math.round(source.height * factor) };
}

export function quoteUpscale(
  plan: { width: number; height: number },
  seconds: number,
  pricing: Record<string, unknown>,
  mode: UpscaleMode
): UpscaleQuote {
  const cents = Number(pricing[PRICE_SKU[mode]]);
  if (!Number.isFinite(cents) || cents <= 0) {
    return { usd: null, credits: null };
  }

  const usd = ((plan.width * plan.height) / PIXELS_PER_MEGAPIXEL) * seconds * (cents / CENTS_PER_USD);
  return { usd, credits: billedCreditsFor(usd) };
}

export function upscaleParams(factor: number, mode: UpscaleMode): { upscale_factor: number; creativity: number } {
  return { upscale_factor: factor, creativity: CREATIVITY[mode] };
}
