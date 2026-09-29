import type { SupabaseClient } from '@supabase/supabase-js';
import type { GenerativeMedium } from '$lib/canvas/default-models';

type CatalogueMedium = Exclude<GenerativeMedium, 'audio'>;
import type { CandidateModel } from '$lib/canvas/recommended-models';
import type { AiModelCatalogue } from './ai-models-sync';
import { isWiroPricing } from './wiro-catalogue';

export type ReleaseRow = {
  id: string;
  label: string | null;
  released_at: string | null;
  expires_at: string | null;
  context_length: number | null;
  intelligence_index: number | null;
  supported_resolutions: string[] | null;
  param_schema: Record<string, unknown> | null;
  pricing: unknown;
  uncensored?: boolean | null;
};

const TOKENS_PER_MILLION = 1_000_000;
const TOKENS_PER_1K_IMAGE = 1290;
const MEGAPIXELS_PER_1K_IMAGE = 1;
const VIDEO_TOKENS_PER_SECOND_720P = (1280 * 720 * 24) / 1024;
const CENTS_PER_USD = 100;

const PER_RUN_METHODS = new Set(['cpr', 'cpo']);

const CATALOGUE_OF: Record<CatalogueMedium, AiModelCatalogue> = { text: 'chat', image: 'image', video: 'video' };

const IMAGE_LINE_USD: Record<string, (cost: number) => number> = {
  image: (cost) => cost,
  token: (cost) => cost * TOKENS_PER_1K_IMAGE,
  megapixel: (cost) => cost * MEGAPIXELS_PER_1K_IMAGE
};

const VIDEO_SKU_USD_PER_SECOND: ReadonlyArray<{ pattern: RegExp; toUsd: (value: number) => number }> = [
  { pattern: /^video_tokens/, toUsd: (v) => v * VIDEO_TOKENS_PER_SECOND_720P },
  { pattern: /^cents_per_(video_output_)?second/, toUsd: (v) => v / CENTS_PER_USD },
  { pattern: /duration_seconds/, toUsd: (v) => v }
];

const VIDEO_SKU_NEEDS_SOURCE_CLIP = /with_video_input|continuation/;

type ImageLine = { billable?: unknown; unit?: unknown; cost_usd?: unknown; variant?: unknown };

function cheapest(costs: number[]): number | null {
  const priced = costs.filter((c) => Number.isFinite(c) && c > 0);
  return priced.length ? Math.min(...priced) : null;
}

function textCost(pricing: unknown): number | null {
  const completion = Number((pricing as { completion?: unknown } | null)?.completion);
  return cheapest([completion * TOKENS_PER_MILLION]);
}

function imageLines(pricing: unknown): ImageLine[] {
  const endpoints = (pricing as { endpoints?: unknown } | null)?.endpoints;
  if (!Array.isArray(endpoints)) {
    return [];
  }
  return endpoints.flatMap((e) => (Array.isArray(e?.lines) ? (e.lines as ImageLine[]) : []));
}

function imageCost(pricing: unknown): number | null {
  if (isWiroPricing(pricing)) {
    return cheapest(pricing.lines.filter((line) => PER_RUN_METHODS.has(line.method)).map((line) => line.usd));
  }
  const costs = imageLines(pricing)
    .filter((line) => line.billable === 'output_image' && !line.variant)
    .map((line) => IMAGE_LINE_USD[String(line.unit)]?.(Number(line.cost_usd)) ?? NaN);
  return cheapest(costs);
}

function videoCost(pricing: unknown): number | null {
  const skus = Object.entries((pricing ?? {}) as Record<string, unknown>);
  const costs = skus
    .filter(([key]) => !VIDEO_SKU_NEEDS_SOURCE_CLIP.test(key))
    .map(([key, value]) => VIDEO_SKU_USD_PER_SECOND.find((rule) => rule.pattern.test(key))?.toUsd(Number(value)) ?? NaN);
  return cheapest(costs);
}

const UNIT_COST: Record<CatalogueMedium, (pricing: unknown) => number | null> = {
  text: textCost,
  image: imageCost,
  video: videoCost
};

function declaredOptions(row: ReleaseRow): number {
  return (row.supported_resolutions?.length ?? 0) + Object.keys(row.param_schema ?? {}).length;
}

const CAPABILITY: Record<CatalogueMedium, (row: ReleaseRow) => number> = {
  text: (row) => row.context_length ?? 0,
  image: declaredOptions,
  video: declaredOptions
};

export function candidateOf(medium: CatalogueMedium, row: ReleaseRow): CandidateModel {
  return {
    id: row.id,
    label: row.label ?? row.id,
    releasedAt: row.released_at,
    expiresAt: row.expires_at,
    unitCostUsd: UNIT_COST[medium](row.pricing),
    benchmark: row.intelligence_index === null ? null : Number(row.intelligence_index),
    capability: CAPABILITY[medium](row)
  };
}

export async function syncedCandidates(admin: SupabaseClient, medium: CatalogueMedium): Promise<CandidateModel[]> {
  const { data, error } = await admin
    .from('ai_models')
    .select('id, label, released_at, expires_at, context_length, intelligence_index, supported_resolutions, param_schema, pricing, uncensored')
    .eq('catalogue', CATALOGUE_OF[medium]);
  if (error) {
    return [];
  }
  return ((data ?? []) as ReleaseRow[]).filter((row) => row.uncensored !== true).map((row) => candidateOf(medium, row));
}
