import { baselined } from '$lib/canvas/code-look';
import type { PageView, ViewRead } from '$lib/server/url-import/page-views';
import { PLAIN_SHAPE, urlPlan, type FontAssets, type UrlPlan } from '$lib/server/url-import/url-doc';
import type { Capture } from './boards';
import { BASE_CONDITIONS, type RenderConditions } from './render-conditions';
import { viewBaselined } from './view-look';

export enum Responsive {
  Views = 'views',
  Boards = 'boards'
}

type Page = { label: string; route?: string; conditions?: RenderConditions };

export type ViewedWidth = { view: PageView; conditions: RenderConditions };

export type Viewed = { base: Capture; baseConditions: RenderConditions; reads: ViewRead[]; widths: ViewedWidth[] };

export type Layout = { viewed: Viewed | null; note: string | null };

const NO_VIEWS: Layout = { viewed: null, note: null };

const conditionsOf = (page: Page) => page.conditions ?? BASE_CONDITIONS;

const pageKey = (page: Page) => `${page.route ?? page.label}|${conditionsOf(page).scheme}`;

const sharesPage = (pages: Page[]) => [...Map.groupBy(pages, pageKey).values()].some((group) => group.length > 1);

export const viewOf = (width: number): PageView => ({ id: `w${width}`, name: `${width}px`, width });

const NEEDS_ONE_PAGE = 'Views need one page in one theme: the widths came in as boards';

export function layoutOf(mode: Responsive, captures: Capture[], pages: Page[]): Layout {
  if (mode === Responsive.Boards || !sharesPage(pages)) {
    return NO_VIEWS;
  }

  const byLabel = new Map(pages.map((p) => [p.label, p]));
  const placed = captures.flatMap((capture) => {
    const page = byLabel.get(capture.label);
    return page ? [{ capture, page }] : [];
  });
  if (placed.length < 2) {
    return NO_VIEWS;
  }
  if (new Set(placed.map((p) => pageKey(p.page))).size > 1) {
    return { viewed: null, note: NEEDS_ONE_PAGE };
  }

  const [widest, ...narrower] = [...placed].sort((a, b) => conditionsOf(b.page).width - conditionsOf(a.page).width);
  const widths = narrower.map((p) => ({ view: viewOf(conditionsOf(p.page).width), conditions: conditionsOf(p.page) }));
  const reads = narrower.map((p, i) => ({ view: widths[i].view, tree: p.capture.tree }));
  return { viewed: { base: widest.capture, baseConditions: conditionsOf(widest.page), reads, widths }, note: null };
}

export function viewedPlan(viewed: Viewed, newId: () => string, fonts: FontAssets = {}): UrlPlan | null {
  const made = urlPlan(viewed.base.tree, newId, undefined, fonts, PLAIN_SHAPE, viewed.reads);
  if (!made) {
    return null;
  }
  const items = made.plan.items.map((item) => ({ ...item, doc: viewBaselined(baselined(item.doc)) }));
  return { ...made, plan: { ...made.plan, items } };
}

export function componentsLeftOut(captures: Capture[]): string[] {
  const names = [...new Set(captures.flatMap((c) => c.uses.map((u) => u.component)))];
  return names.length ? [`${names.join(', ')}: not extracted as components, the widths are views; import with boards to keep components`] : [];
}

export const responsiveOf = (origin: { map?: { pages: { boards?: { view?: string }[] }[] } }): Responsive => (origin.map?.pages.some((p) => p.boards?.some((b) => b.view)) ? Responsive.Views : Responsive.Boards);
