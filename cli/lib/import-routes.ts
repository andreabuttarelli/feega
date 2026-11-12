export enum RoutesStep {
  Discover = 'discover',
  Import = 'import'
}

const DISCOVER = 'discover';
const ALL = 'all';

export type RoutesPlan = { step: RoutesStep.Discover } | { step: RoutesStep.Import; routes: string[] | typeof ALL };

export function routesPlan(spec: string | undefined, route: string[]): RoutesPlan {
  if (spec === DISCOVER) {
    return { step: RoutesStep.Discover };
  }
  if (spec === ALL) {
    return { step: RoutesStep.Import, routes: ALL };
  }
  return { step: RoutesStep.Import, routes: spec === undefined ? route : spec.split(/[\s,]+/).filter(Boolean) };
}
