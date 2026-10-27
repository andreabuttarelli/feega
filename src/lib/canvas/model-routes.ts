import type { GenParams, ModelChoice, RouteOption } from './gen-node';

export const AUTO_ROUTE = 'auto';

export const PROVIDER_PARAM = 'provider';

export function routeOf(choice: ModelChoice | null | undefined, provider: string | undefined): RouteOption | undefined {
  return choice?.routes?.find((route) => route.provider === (provider ?? AUTO_ROUTE));
}

export function pricedFor(choice: ModelChoice | null, params: GenParams): ModelChoice | null {
  const route = routeOf(choice, params.provider);
  if (!choice || !route) {
    return choice;
  }
  return { ...choice, unitCredits: undefined, pricedInputs: undefined, creditOverrides: undefined, variableCredits: undefined, perSecondCredits: undefined, ...route.price };
}

const AUTO_DESCRIPTION = 'Cheapest healthy provider, falls back if it fails';
const PERCENT = 100;
const MS_PER_S = 1000;

function statsText(stats: NonNullable<RouteOption['stats']>): string | null {
  const parts = [
    stats.successRate === null ? null : `${Math.round(stats.successRate * PERCENT)}% success`,
    stats.p95Ms === null ? null : `~${Math.round(stats.p95Ms / MS_PER_S)} s`
  ].filter((part): part is string => part !== null);
  return parts.length ? parts.join(' · ') : null;
}

export function routeStatsLabel(route: RouteOption): string | null {
  if (route.provider === AUTO_ROUTE) {
    return AUTO_DESCRIPTION;
  }
  if (!route.stats) {
    return null;
  }
  const text = statsText(route.stats);
  if (route.stats.healthy) {
    return text;
  }
  return `Unreliable now${text ? `: ${text}` : ''}. Auto skips it`;
}
