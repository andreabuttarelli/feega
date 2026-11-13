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

export type CodeSource = { repo: string } | { folder: string } | { into: string };

const LOCAL_PATH = '/';

export function codeSource(repo: string | undefined, into: string | undefined): CodeSource | null {
  if (repo && into) {
    return null;
  }
  if (into) {
    return { into };
  }
  if (!repo) {
    return null;
  }
  return repo.startsWith(LOCAL_PATH) ? { folder: repo } : { repo };
}
