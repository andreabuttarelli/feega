import { env } from '$env/dynamic/private';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GenParams, ModelChoice, PricedInputs } from '$lib/canvas/gen-node';
import { creditsForRun } from '$lib/canvas/gen-cost';
import { billedCreditsFor, CREDITS_PER_USD_SUBSCRIPTION_LIST } from '$lib/credit-ladder';
import { configuredIn, TASK_PROVIDERS, TaskProviderName, RouteRole, type TaskMedium } from './task-providers';
import { discountCandidateOf, discountRouteFor, routeHealthOf, type DiscountCandidate, type DiscountRoute, type RouteHealth } from './discount-route';

const HEALTH_WINDOW = 50;

const DISCOUNT_PROVIDERS = Object.values(TaskProviderName).filter((provider) => TASK_PROVIDERS[provider].role === RouteRole.Discount);

export type DiscountBook = { provider: TaskProviderName; candidates: ReadonlyMap<string, DiscountCandidate>; health: RouteHealth };

type HealthRow = { status: string; latency_ms: number | null };

async function healthOf(admin: SupabaseClient, provider: TaskProviderName, medium: TaskMedium): Promise<RouteHealth> {
  const { data } = await admin
    .from('ai_calls')
    .select('status, latency_ms')
    .eq('provider', provider)
    .order('created_at', { ascending: false })
    .limit(HEALTH_WINDOW);
  const samples = ((data ?? []) as HealthRow[]).map((row) => ({ ok: row.status === 'ok', ms: row.latency_ms ?? 0 }));
  return routeHealthOf(medium, samples);
}

export async function discountBook(admin: SupabaseClient, medium: TaskMedium): Promise<DiscountBook | null> {
  const configured = configuredIn(env);
  const provider = DISCOUNT_PROVIDERS.find((name) => configured.has(name));
  if (!provider) {
    return null;
  }
  const { data } = await admin.from('ai_models').select('id, pricing, wire_spec').eq('catalogue', medium).eq('provider', provider);
  const candidates = new Map(
    ((data ?? []) as Array<{ id: string; pricing: unknown; wire_spec: unknown }>)
      .map(discountCandidateOf)
      .filter((c): c is DiscountCandidate => c !== null)
      .map((c) => [c.discountFor, c])
  );
  return candidates.size ? { provider, candidates, health: await healthOf(admin, provider, medium) } : null;
}

function primaryUsdOf(choice: ModelChoice, medium: TaskMedium, params: GenParams): number | null {
  const credits = creditsForRun({ medium, model: choice, params });
  return credits === null ? null : credits / CREDITS_PER_USD_SUBSCRIPTION_LIST;
}

export function routeFor(book: DiscountBook | null, choice: ModelChoice, medium: TaskMedium, params: GenParams): DiscountRoute | null {
  const candidate = book?.candidates.get(choice.id);
  if (!book || !candidate) {
    return null;
  }
  return discountRouteFor({ candidate, health: book.health, params, primaryUsd: primaryUsdOf(choice, medium, params) });
}

const NO_RESOLUTION = '';

function lineFor(book: DiscountBook, choice: ModelChoice, medium: TaskMedium, resolution: string): { line: PricedInputs; discounted: boolean } | null {
  const params: GenParams = resolution === NO_RESOLUTION ? {} : { resolution };
  const route = routeFor(book, choice, medium, params);
  const credits = route ? billedCreditsFor(route.usd) : creditsForRun({ medium, model: choice, params });
  return credits === null ? null : { line: { inputs: { resolution }, credits }, discounted: Boolean(route) };
}

export function withDiscountPrices(book: DiscountBook | null, choice: ModelChoice, medium: TaskMedium): ModelChoice {
  if (!book?.candidates.has(choice.id)) {
    return choice;
  }
  const lines = [NO_RESOLUTION, ...(choice.resolutions ?? [])]
    .map((resolution) => lineFor(book, choice, medium, resolution))
    .filter((entry): entry is { line: PricedInputs; discounted: boolean } => entry !== null);
  if (!lines.some((entry) => entry.discounted)) {
    return choice;
  }
  return {
    ...choice,
    pricedInputs: lines.map((entry) => entry.line),
    variableCredits: !lines.some((entry) => entry.line.inputs.resolution === NO_RESOLUTION),
    discountRoute: { provider: book.provider, label: TASK_PROVIDERS[book.provider].label }
  };
}
