import { env } from '$env/dynamic/private';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GenParams, ModelChoice, PricedInputs, RouteOption, RoutePrice, RouteStats } from '$lib/canvas/gen-node';
import { AUTO_ROUTE } from '$lib/canvas/model-routes';
import { creditsForRun } from '$lib/canvas/gen-cost';
import { billedCreditsFor, CREDITS_PER_USD_SUBSCRIPTION_LIST } from '$lib/credit-ladder';
import { configuredIn, TASK_PROVIDERS, TaskProviderName, RouteRole, type TaskMedium } from './task-providers';
import { discountCandidateOf, discountRouteFor, RouteChoice, RouteHealth, routeHealthOf, sampleStatsOf, type DiscountCandidate, type DiscountRoute } from './discount-route';

const HEALTH_WINDOW = 50;

const DISCOUNT_PROVIDERS = Object.values(TaskProviderName).filter((provider) => TASK_PROVIDERS[provider].role === RouteRole.Discount);

export type DiscountBook = { provider: TaskProviderName; candidates: ReadonlyMap<string, DiscountCandidate>; health: RouteHealth; stats?: RouteStats };

type HealthRow = { status: string; latency_ms: number | null };

async function healthOf(admin: SupabaseClient, provider: TaskProviderName, medium: TaskMedium): Promise<{ health: RouteHealth; stats: RouteStats }> {
  const { data } = await admin
    .from('ai_calls')
    .select('status, latency_ms')
    .eq('provider', provider)
    .order('created_at', { ascending: false })
    .limit(HEALTH_WINDOW);
  const samples = ((data ?? []) as HealthRow[]).map((row) => ({ ok: row.status === 'ok', ms: row.latency_ms ?? 0 }));
  const health = routeHealthOf(medium, samples);
  return { health, stats: { ...sampleStatsOf(samples), healthy: health === RouteHealth.Healthy } };
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
  return candidates.size ? { provider, candidates, ...(await healthOf(admin, provider, medium)) } : null;
}

function primaryUsdOf(choice: ModelChoice, medium: TaskMedium, params: GenParams): number | null {
  const credits = creditsForRun({ medium, model: choice, params });
  return credits === null ? null : credits / CREDITS_PER_USD_SUBSCRIPTION_LIST;
}

export const PRIMARY_ROUTE = { provider: 'openrouter', label: 'OpenRouter' } as const;

const AUTO_LABEL = 'Auto (cheapest healthy)';

function choiceOf(book: DiscountBook, provider: string | undefined): RouteChoice | null {
  if (!provider || provider === AUTO_ROUTE) {
    return RouteChoice.Auto;
  }
  return provider === book.provider ? RouteChoice.Forced : null;
}

export function routeFor(book: DiscountBook | null, choice: ModelChoice, medium: TaskMedium, params: GenParams): DiscountRoute | null {
  const candidate = book?.candidates.get(choice.id);
  const routeChoice = book ? choiceOf(book, params.provider) : null;
  if (!book || !candidate || !routeChoice) {
    return null;
  }
  return discountRouteFor({ candidate, health: book.health, params, primaryUsd: primaryUsdOf(choice, medium, params), choice: routeChoice });
}

const NO_RESOLUTION = '';

type Line = { line: PricedInputs; discounted: boolean };

function lineFor(book: DiscountBook, choice: ModelChoice, medium: TaskMedium, resolution: string, provider: string): Line | null {
  const params: GenParams = { ...(resolution === NO_RESOLUTION ? {} : { resolution }), provider };
  const route = routeFor(book, choice, medium, params);
  const credits = route ? billedCreditsFor(route.usd) : provider === book.provider ? null : creditsForRun({ medium, model: choice, params: { ...params, provider: undefined } });
  return credits === null ? null : { line: { inputs: { resolution }, credits }, discounted: Boolean(route) };
}

function linesFor(book: DiscountBook, choice: ModelChoice, medium: TaskMedium, provider: string): Line[] {
  return [NO_RESOLUTION, ...(choice.resolutions ?? [])]
    .map((resolution) => lineFor(book, choice, medium, resolution, provider))
    .filter((entry): entry is Line => entry !== null);
}

function linePrice(lines: Line[]): RoutePrice {
  return { pricedInputs: lines.map((entry) => entry.line), variableCredits: !lines.some((entry) => entry.line.inputs.resolution === NO_RESOLUTION) };
}

function primaryPrice(choice: ModelChoice): RoutePrice {
  return { unitCredits: choice.unitCredits, pricedInputs: choice.pricedInputs, creditOverrides: choice.creditOverrides, variableCredits: choice.variableCredits };
}

export function withDiscountPrices(book: DiscountBook | null, choice: ModelChoice, medium: TaskMedium): ModelChoice {
  if (!book?.candidates.has(choice.id)) {
    return choice;
  }
  const auto = linesFor(book, choice, medium, AUTO_ROUTE);
  const discounted = auto.some((entry) => entry.discounted);
  const autoPrice = discounted ? linePrice(auto) : primaryPrice(choice);
  const routes: RouteOption[] = [
    { provider: AUTO_ROUTE, label: AUTO_LABEL, price: autoPrice, stats: null },
    { provider: PRIMARY_ROUTE.provider, label: PRIMARY_ROUTE.label, price: primaryPrice(choice), stats: null },
    { provider: book.provider, label: TASK_PROVIDERS[book.provider].label, price: linePrice(linesFor(book, choice, medium, book.provider)), stats: book.stats ?? { successRate: null, p95Ms: null, healthy: book.health === RouteHealth.Healthy } }
  ];
  return {
    ...choice,
    ...autoPrice,
    routes,
    discountRoute: discounted ? { provider: book.provider, label: TASK_PROVIDERS[book.provider].label } : undefined
  };
}
