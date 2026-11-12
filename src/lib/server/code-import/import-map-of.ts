import { PageState, type ImportMap, type MapPage } from '$lib/canvas/import-map';
import { leftOut, RouteLeftOut, type RoutesFound } from './routes-found';
import type { CodeImported, CodeImportOutcome } from './import-code';

type Landed = Extract<CodeImported, { outcome: CodeImportOutcome.Ok }>;

export type MapAsk = { asked: string[]; rev: string | null };

const LABEL_SEPARATOR = ' · ';

const routeOf = (label: string) => label.split(LABEL_SEPARATOR)[0];

const LEFT_OUT: Record<RouteLeftOut, PageState> = {
  [RouteLeftOut.NotSelected]: PageState.NotSelected,
  [RouteLeftOut.NeedsValue]: PageState.NeedsValue,
  [RouteLeftOut.NotOpened]: PageState.Failed
};

const NOT_OPENED = 'could not be opened';

function imported(done: Landed): MapPage[] {
  const byRoute = new Map<string, NonNullable<Landed['boards']>>();
  for (const board of done.boards ?? []) {
    byRoute.set(board.route, [...(byRoute.get(board.route) ?? []), board]);
  }
  return [...byRoute].map(([path, boards]) => ({ path, state: PageState.Imported, boards: boards.map((b) => ({ cond: b.cond, clip: b.clip })) }));
}

function unlanded(done: Landed): MapPage[] {
  const failed = (done.missed ?? []).map((m) => ({ path: routeOf(m.label), state: PageState.Failed, reason: m.reason }));
  const locked = (done.locked ?? []).map((l) => ({ path: routeOf(l.label), state: PageState.Locked, reason: l.reason }));
  return [...failed, ...locked];
}

function discovered(found: RoutesFound, done: Landed, asked: string[]): MapPage[] {
  if (!found.ok) {
    return [];
  }
  return leftOut(found.routes, { asked, landed: done.pages, links: done.links ?? [] }).map((r) => ({
    path: r.path,
    state: LEFT_OUT[r.reason],
    ...(r.reason === RouteLeftOut.NotOpened ? { reason: NOT_OPENED } : {}),
    ...(r.candidates.length ? { values: r.candidates.slice(0, 8).map((c) => c.path) } : {})
  }));
}

function designOf(done: Landed): ImportMap['design'] {
  const d = done.design;
  return d ? { tokens: d.tokens, styles: d.styles, bound: d.byClass + d.byRule + d.byValue, unbound: d.unbound } : undefined;
}

export function mapOf(found: RoutesFound, done: Landed, ask: MapAsk): ImportMap {
  const pages = new Map<string, MapPage>();
  for (const page of [...imported(done), ...unlanded(done), ...discovered(found, done, ask.asked)]) {
    if (!pages.has(page.path)) {
      pages.set(page.path, page);
    }
  }
  const library = done.library ? { captured: done.library.components.filter((c) => c.captured).map((c) => c.name), uncaptured: done.library.uncaptured } : undefined;
  const design = designOf(done);
  return { rev: ask.rev, pages: [...pages.values()], ...(library ? { library } : {}), ...(design ? { design } : {}), ...(found.ok ? {} : { unrun: `${found.error}: ${found.detail}` }) };
}
