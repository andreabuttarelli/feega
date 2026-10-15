import type { GenParams } from '$lib/canvas/gen-node';
import type { WireFields } from '$lib/server/canvas/task-provider';
import { isTaskPricing, taskUsdFor, type TaskPricing } from './task-pricing';
import type { TaskMedium } from './task-providers';
import { wireInputs } from './wire-inputs';

export enum RouteHealth {
  Healthy = 'healthy',
  Demoted = 'demoted'
}

export enum RouteChoice {
  Auto = 'auto',
  Forced = 'forced'
}

export type DiscountCandidate = {
  id: string;
  discountFor: string;
  fields: WireFields;
  defaults: Readonly<Record<string, string>>;
  pricing: TaskPricing;
};

export type DiscountRoute = { modelId: string; usd: number; params: GenParams };

type CandidateRow = { id: string; pricing?: unknown; wire_spec?: unknown };

export function discountCandidateOf(row: CandidateRow): DiscountCandidate | null {
  const spec = row.wire_spec as { discountFor?: unknown; fields?: WireFields; defaults?: Record<string, string> } | null;
  if (typeof spec?.discountFor !== 'string' || !spec.fields || !isTaskPricing(row.pricing)) {
    return null;
  }
  return { id: row.id, discountFor: spec.discountFor, fields: spec.fields, defaults: spec.defaults ?? {}, pricing: row.pricing };
}

function withDefaults(candidate: DiscountCandidate, params: GenParams): GenParams {
  const filled = { ...candidate.defaults, ...Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')) };
  return filled as GenParams;
}

export function discountRouteFor(input: {
  candidate: DiscountCandidate;
  health: RouteHealth;
  params: GenParams;
  primaryUsd: number | null;
  choice?: RouteChoice;
}): DiscountRoute | null {
  const forced = input.choice === RouteChoice.Forced;
  if (!forced && input.health === RouteHealth.Demoted) {
    return null;
  }
  const params = withDefaults(input.candidate, input.params);
  const usd = taskUsdFor(input.candidate.pricing, wireInputs(input.candidate.fields, { prompt: '', params, imageUrls: [], lastFrameUrl: null }, {}));
  if (usd === null) {
    return null;
  }
  if (!forced && input.primaryUsd !== null && usd >= input.primaryUsd) {
    return null;
  }
  return { modelId: input.candidate.id, usd, params };
}

export type CallSample = { ok: boolean; ms: number };

const MIN_SAMPLES = 10;
const MIN_SUCCESS_RATE = 0.95;
const P95 = 0.95;

const MAX_P95_MS: Readonly<Record<TaskMedium, number>> = {
  image: 120_000,
  video: 900_000,
  model3d: 900_000
};

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(fraction * sorted.length) - 1)] ?? 0;
}

export type RouteSampleStats = { successRate: number | null; p95Ms: number | null };

export function sampleStatsOf(samples: readonly CallSample[]): RouteSampleStats {
  if (!samples.length) {
    return { successRate: null, p95Ms: null };
  }
  const delivered = samples.filter((s) => s.ok).map((s) => s.ms);
  return { successRate: delivered.length / samples.length, p95Ms: delivered.length ? percentile(delivered, P95) : null };
}

export function routeHealthOf(medium: TaskMedium, samples: readonly CallSample[]): RouteHealth {
  if (samples.length < MIN_SAMPLES) {
    return RouteHealth.Healthy;
  }
  const successRate = samples.filter((s) => s.ok).length / samples.length;
  const p95 = percentile(samples.filter((s) => s.ok).map((s) => s.ms), P95);
  return successRate < MIN_SUCCESS_RATE || p95 > MAX_P95_MS[medium] ? RouteHealth.Demoted : RouteHealth.Healthy;
}
