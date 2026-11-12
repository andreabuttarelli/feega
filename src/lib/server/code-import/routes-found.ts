import { routeMatches } from '$lib/canvas/route-pattern';
import { MAX_ROUTES } from './repo';
import { discoverRoutes, DiscoveryRefusal, linkCandidates, routeTexts, RouteKind, type Candidate, type DiscoveredRoute } from './routes-discover';
import { planFile, PlanRefusal, runPlan, textsWanted, type Framework } from './run-plan';
import type { ReadFile } from './write-back';

export const UNREADABLE = 'unreadable';

export type RouteSource = { files: () => Promise<string[] | null>; read: ReadFile };

export type RoutesFound = { ok: true; framework: Framework; app: string; routes: DiscoveredRoute[] } | { ok: false; error: PlanRefusal | DiscoveryRefusal | typeof UNREADABLE; detail: string; apps: string[] };

const UNLISTENED = { host: '127.0.0.1', port: 0 };

async function textsOf(read: ReadFile, paths: string[]): Promise<Record<string, string>> {
  const texts = await Promise.all(paths.map(async (p) => [p, await read(p).catch(() => null)] as const));
  return Object.fromEntries(texts.filter((t): t is readonly [string, string] => t[1] !== null));
}

export async function routesAt(source: RouteSource, app: string | null): Promise<RoutesFound> {
  const files = await source.files().catch(() => null);
  if (!files?.length) {
    return { ok: false, error: UNREADABLE, detail: 'the file list of this source could not be read', apps: [] };
  }

  const planned = files.filter(planFile);
  const plan = runPlan({ files: planned, texts: await textsOf(source.read, textsWanted(planned)) }, app, UNLISTENED);
  if (!plan.ok) {
    return { ok: false, error: plan.refusal, detail: plan.reason, apps: plan.apps };
  }

  const texts = await textsOf(source.read, routeTexts(files, plan.framework, plan.appDir));
  const found = discoverRoutes({ files, texts }, plan.framework, plan.appDir);
  if (!found.ok) {
    return { ok: false, error: found.refusal, detail: found.reason, apps: [] };
  }
  return { ok: true, framework: plan.framework, app: plan.appDir, routes: found.routes };
}

export enum RouteLeftOut {
  NotSelected = 'not_selected',
  NeedsValue = 'needs_value',
  NotOpened = 'not_opened'
}

export type LeftOut = { path: string; reason: RouteLeftOut; candidates: Candidate[] };

export type Imported = { asked: string[]; landed: string[]; links: string[] };

const LABEL_SEPARATOR = ' · ';

const UNIMPORTED: Record<RouteKind, RouteLeftOut> = {
  [RouteKind.Static]: RouteLeftOut.NotSelected,
  [RouteKind.Dynamic]: RouteLeftOut.NeedsValue
};

export function leftOut(routes: DiscoveredRoute[], imported: Imported): LeftOut[] {
  const landed = imported.landed.map((label) => label.split(LABEL_SEPARATOR)[0]);
  return linkCandidates(routes, imported.links).flatMap((route) => {
    if (landed.some((p) => routeMatches(route.path, p))) {
      return [];
    }
    const reason = imported.asked.some((p) => routeMatches(route.path, p)) ? RouteLeftOut.NotOpened : UNIMPORTED[route.kind];
    return [{ path: route.path, reason, candidates: route.candidates.filter((c) => !landed.includes(c.path)) }];
  });
}

export const allRoutes = (routes: DiscoveredRoute[]) => routes.filter((r) => r.selected).map((r) => r.path);

export const tooManyRoutes = (routes: string[]): string | null => (routes.length > MAX_ROUTES ? `${routes.length} pages asked, at most ${MAX_ROUTES} per import: pick fewer` : null);

export const ROUTES_STATUS: Record<Exclude<RoutesFound, { ok: true }>['error'], number> = {
  [UNREADABLE]: 422,
  [PlanRefusal.ChooseApp]: 409,
  [PlanRefusal.NoPackage]: 422,
  [PlanRefusal.NoScript]: 422,
  [DiscoveryRefusal.NoRouter]: 422,
  [DiscoveryRefusal.InCode]: 422
};
