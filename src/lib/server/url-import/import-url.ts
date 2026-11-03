import { z } from 'zod';
import { parseMotionDoc } from '@feega/motion-core/motion/doc';
import { imagesFilled, type ImageAssets } from '$lib/canvas/figma/images';
import { DocRejected, placeFigmaPlan, type FrameStore, type Place } from '$lib/server/motion/move-element';
import type { UndoItem } from '$lib/canvas/undo-plan';
import { homedAt } from '$lib/motion/canvas-components';
import type { AppTab, OpenAppBrowser } from '$lib/server/web/browser';
import { BrowserBusy } from '$lib/server/web/browser-slots';
import { dismissOverlays } from '$lib/server/web/overlays';
import { SnapMode, TREE_LIMITS, type PageTree } from './page-tree';
import { RevealMode } from './page-reveal';
import type { PageOutline } from './page-outline';
import { PatternKind } from './page-patterns';
import { sheetFonts, type FetchText } from './sheet-fonts';
import type { PageView, ViewRead } from './page-views';
import type { Homes } from './component-sheet';
import { FULL_SHAPE, fontsWanted, urlPlan, type FontAssets, type PageShape, type UrlPlan } from './url-doc';

export enum UrlImportOutcome {
  Ok = 'ok',
  Invalid = 'invalid',
  NotPublic = 'not_public',
  NoBrowser = 'no_browser',
  Failed = 'failed',
  Unreadable = 'unreadable',
  TooSlow = 'too_slow',
  RateLimited = 'rate_limited',
  Busy = 'busy',
  Rejected = 'rejected'
}

export enum PageExtent {
  Top = 'top',
  Full = 'full'
}

const FIRST_SCREENS_PX = 1800;

export const PAGE_EXTENT_HEIGHT: Record<PageExtent, number | undefined> = {
  [PageExtent.Top]: FIRST_SCREENS_PX,
  [PageExtent.Full]: undefined
};

export const URL_IMPORT_STATUS: Record<Exclude<UrlImportOutcome, UrlImportOutcome.Ok>, number> = {
  [UrlImportOutcome.Invalid]: 400,
  [UrlImportOutcome.NotPublic]: 400,
  [UrlImportOutcome.NoBrowser]: 503,
  [UrlImportOutcome.Failed]: 502,
  [UrlImportOutcome.Unreadable]: 422,
  [UrlImportOutcome.TooSlow]: 504,
  [UrlImportOutcome.RateLimited]: 429,
  [UrlImportOutcome.Busy]: 503,
  [UrlImportOutcome.Rejected]: 422
};

export type UrlImported = { outcome: UrlImportOutcome.Ok; frameId: string; name: string; undo: UndoItem[]; skipped: string[]; truncated: boolean } | { outcome: Exclude<UrlImportOutcome, UrlImportOutcome.Ok>; error?: string };

export type Planner = { prepare: (tab: AppTab) => Promise<void>; plan: (tree: PageTree, newId: () => string, fonts: FontAssets, shape: PageShape, views: ViewRead[]) => UrlPlan | null };

export const PLAIN_PLANNER: Planner = { prepare: async () => undefined, plan: (tree, newId, fonts, shape, views) => urlPlan(tree, newId, undefined, fonts, shape, views) };

export type PageAsk = {
  url: string;
  at: { x: number; y: number };
  store: FrameStore;
  place: Place;
  open: OpenAppBrowser | null;
  guard: (url: URL) => Promise<void>;
  importImage: (url: string) => Promise<string | null>;
  importFont?: (url: string, page: string) => Promise<string | null>;
  fetchText?: FetchText;
  newId: () => string;
  settleMs?: number;
  planner?: Planner;
  maxHeight?: number;
  shape?: PageShape;
  components?: () => Promise<ComponentsPage>;
  views?: PageView[];
};

export type ComponentsPage = { place: Place; at: { x: number; y: number } };

const SETTLE_MS = 1_200;
const SCROLL_STEP_PX = 700;
const SCROLL_PAUSES = 8;
const NETWORK_IDLE_MS = 6_000;
const HTTP_ERROR = 400;
const WEB_SCHEMES = ['http:', 'https:'];
const FILLED_SUMMARY = 'Filled page images';
const HOMED_SUMMARY = 'Linked components to their sheet';

const BOX_SHAPE = z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() });

const FONT_SHAPE = z.object({ family: z.string(), weight: z.string(), style: z.string(), url: z.string() });

const SNAP_SHAPE = z.object({ ref: z.string(), box: BOX_SHAPE, mode: z.nativeEnum(SnapMode) });

const NODE_SHAPE = z.object({ id: z.string(), type: z.string() }).passthrough();

const PATTERN_SHAPE = z.object({ ix: z.number().int(), kind: z.nativeEnum(PatternKind), prop: z.string().min(1), initial: z.string().min(1), states: z.array(z.string().min(1)), variants: z.array(z.object({ state: z.string().min(1), root: NODE_SHAPE })) });

const TREE_SHAPE = z
  .object({
    title: z.string(),
    url: z.string(),
    width: z.number().positive(),
    height: z.number().positive(),
    truncated: z.boolean(),
    root: z.object({ type: z.literal('FRAME') }).passthrough(),
    fonts: z.array(FONT_SHAPE).optional(),
    sheets: z.array(z.string()).optional(),
    snaps: z.array(SNAP_SHAPE).optional(),
    outline: z.custom<PageOutline>((v) => typeof v === 'object' && v !== null).optional(),
    patterns: z.array(PATTERN_SHAPE).optional()
  })
  .strict();

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const refused = (outcome: Exclude<UrlImportOutcome, UrlImportOutcome.Ok>, error?: string): UrlImported => ({ outcome, ...(error ? { error } : {}) });

export async function publicUrl(raw: string, guard: PageAsk['guard']): Promise<URL | null> {
  const url = URL.canParse(raw) ? new URL(raw) : null;
  if (!url || !WEB_SCHEMES.includes(url.protocol)) {
    return null;
  }
  return guard(url).then(
    () => url,
    () => null
  );
}

export enum Sight {
  Everything = 'everything',
  Native = 'native'
}

const SIGHTED: Record<Sight, (tab: AppTab) => Promise<void>> = {
  [Sight.Everything]: (tab) => tab.seeAll().catch(() => undefined),
  [Sight.Native]: async () => undefined
};

export async function pagePrepared(tab: AppTab, url: URL, settleMs: number, planner: Planner, maxHeight = TREE_LIMITS.height, sight = Sight.Everything): Promise<UrlImported | null> {
  await SIGHTED[sight](tab);
  const status = await tab.goto(url.toString()).catch(() => null);
  if (status !== null && status >= HTTP_ERROR) {
    return refused(UrlImportOutcome.Failed, `the page answered ${status}`);
  }
  await tab.settle(NETWORK_IDLE_MS);
  const { height } = await tab.reveal(RevealMode.Loading).catch(() => ({ height: TREE_LIMITS.height }));
  const steps = Math.ceil(Math.min(height, maxHeight) / SCROLL_STEP_PX);
  await tab.sample({ steps, stepPx: SCROLL_STEP_PX, pauseMs: settleMs / SCROLL_PAUSES }).catch(() => 0);
  await tab.settle(NETWORK_IDLE_MS);
  await tab.scroll({ to: 'top' }).catch(() => undefined);
  await pause(settleMs);
  await tab.reveal(RevealMode.Moving).catch(() => undefined);
  await tab.sample().catch(() => 0);
  await pause(settleMs / SCROLL_PAUSES);
  await tab.sample().catch(() => 0);
  await dismissOverlays(tab).catch(() => []);
  await planner.prepare(tab).catch(() => undefined);
  await tab.settle(NETWORK_IDLE_MS);
  await pause(settleMs);
  await tab.reveal(RevealMode.Still).catch(() => undefined);
  return null;
}

export async function pageTreeAt(tab: AppTab, url: URL, settleMs: number, planner: Planner, maxHeight?: number, sight = Sight.Everything): Promise<PageTree | UrlImported> {
  const refusal = await pagePrepared(tab, url, settleMs, planner, maxHeight, sight);
  if (refusal) {
    return refusal;
  }
  const parsed = TREE_SHAPE.safeParse(await tab.tree(maxHeight).catch(() => null));
  return parsed.success ? (parsed.data as unknown as PageTree) : refused(UrlImportOutcome.Unreadable);
}

export type LandAsk = Pick<PageAsk, 'store' | 'place' | 'at' | 'importImage' | 'importFont' | 'fetchText' | 'components'>;

async function imported(ask: LandAsk, images: Record<string, string>): Promise<ImageAssets> {
  const entries = await Promise.all(Object.entries(images).map(async ([hash, url]) => [hash, await ask.importImage(url).catch(() => null)] as const));
  return Object.fromEntries(entries.filter((e): e is readonly [string, string] => Boolean(e[1])));
}

export async function withSheetFonts(ask: LandAsk, tree: PageTree): Promise<PageTree> {
  if (!ask.fetchText || !tree.sheets?.length) {
    return tree;
  }
  return { ...tree, fonts: [...(tree.fonts ?? []), ...(await sheetFonts(tree.sheets, ask.fetchText))] };
}

export async function fontsFor(ask: LandAsk, tree: PageTree): Promise<FontAssets> {
  const importFont = ask.importFont;
  if (!importFont) {
    return {};
  }
  const entries = await Promise.all(fontsWanted(tree).map(async (face) => [face.url, await importFont(face.url, tree.url).catch(() => null)] as const));
  return Object.fromEntries(entries.filter((e): e is readonly [string, string] => Boolean(e[1])));
}

type PlacedSets = { frameIds: string[]; undo: UndoItem[]; skipped: string[] };

async function placedSet(ask: LandAsk, place: Place, at: { x: number; y: number }, set: UrlPlan['sets'][number]): Promise<PlacedSets> {
  try {
    const placed = await placeFigmaPlan(ask.store, place, { items: [set], skipped: [], fileKey: null }, at);
    return { frameIds: placed.frameIds.slice(0, 1), undo: placed.undo, skipped: [] };
  } catch (e) {
    if (!(e instanceof DocRejected)) {
      throw e;
    }
    return { frameIds: [''], undo: [], skipped: [`${set.name}: component set left out, ${e.message}`] };
  }
}

async function placedSets(ask: LandAsk, sets: UrlPlan['sets']): Promise<PlacedSets> {
  if (!sets.length || !ask.components) {
    return { frameIds: [], undo: [], skipped: [] };
  }
  const page = await ask.components();
  const placed: PlacedSets[] = [];
  for (const set of sets) {
    placed.push(await placedSet(ask, page.place, page.at, set));
  }
  return { frameIds: placed.flatMap((p) => p.frameIds), undo: placed.flatMap((p) => p.undo), skipped: placed.flatMap((p) => p.skipped) };
}

async function homedOnSets(store: FrameStore, frameIds: string[], setIds: string[], homes: Homes): Promise<void> {
  for (const [page, comps] of Object.entries(homes)) {
    const pageId = frameIds[Number(page)];
    const frame = pageId ? await store.read(pageId) : null;
    const byComp = Object.fromEntries(Object.entries(comps).flatMap(([compId, set]) => (setIds[set] ? [[compId, setIds[set]]] : [])));
    if (frame && Object.keys(byComp).length) {
      await store.write(pageId, frame.version, homedAt(frame.doc, byComp), HOMED_SUMMARY);
    }
  }
}

async function filled(ask: LandAsk, frameIds: string[], items: UrlPlan['sets'], assets: ImageAssets): Promise<void> {
  for (const [i, frameId] of frameIds.entries()) {
    if (!frameId) {
      continue;
    }
    const frame = await ask.store.read(frameId);
    const images = items[i]?.images ?? [];
    if (frame && images.length && Object.keys(assets).length) {
      await ask.store.write(frameId, frame.version, imagesFilled(frame.doc, images, assets), FILLED_SUMMARY);
    }
  }
}

async function readAndLand(ask: PageAsk): Promise<UrlImported> {
  const url = await publicUrl(ask.url, ask.guard);
  if (!url) {
    return refused(UrlImportOutcome.NotPublic);
  }
  if (!ask.open) {
    return refused(UrlImportOutcome.NoBrowser);
  }

  const open = ask.open;
  const planner = ask.planner ?? PLAIN_PLANNER;
  const unreadable = (read: PageTree | UrlImported) => 'outcome' in read && read.outcome === UrlImportOutcome.Unreadable;
  const readWith = async (sight: Sight) => {
    const tab = await open();
    const read = await pageTreeAt(tab, url, ask.settleMs ?? SETTLE_MS, planner, ask.maxHeight, sight).finally(() => tab.close());
    return unreadable(read) && tab.left() <= 0 ? refused(UrlImportOutcome.TooSlow) : read;
  };
  const readPage = async () => {
    const first = await readWith(Sight.Everything);
    return unreadable(first) ? readWith(Sight.Native) : first;
  };
  const readView = async (view: PageView): Promise<ViewRead[]> => {
    const tab = await open();
    await tab.viewport(view.width).catch(() => undefined);
    const narrow = await pageTreeAt(tab, url, ask.settleMs ?? SETTLE_MS, planner, ask.maxHeight).finally(() => tab.close());
    return 'outcome' in narrow ? [] : [{ view, tree: narrow }];
  };
  const readViewsInTurn = async () => {
    const reads: ViewRead[][] = [];
    for (const view of ask.views ?? []) {
      reads.push(await readView(view).catch(() => []));
    }
    return reads;
  };
  const [read, narrow] = await Promise.all([readPage(), readViewsInTurn()]);
  if ('outcome' in read) {
    return read;
  }
  const tree = await withSheetFonts(ask, read);
  const views = narrow.flat();

  return landPlan(ask, planner.plan(tree, ask.newId, await fontsFor(ask, tree), ask.shape ?? FULL_SHAPE, views), tree.truncated);
}

export async function importPageAt(ask: PageAsk): Promise<UrlImported> {
  try {
    return await readAndLand(ask);
  } catch (e) {
    if (e instanceof BrowserBusy) {
      return refused(UrlImportOutcome.Busy);
    }
    if (e instanceof DocRejected) {
      return refused(UrlImportOutcome.Rejected, e.message);
    }
    throw e;
  }
}

export async function landPlan(ask: LandAsk, made: UrlPlan | null, truncated: boolean): Promise<UrlImported> {
  if (!made?.plan.items.length) {
    return refused(UrlImportOutcome.Unreadable);
  }

  const refusal = refusalOf(made.plan.items);
  if (refusal) {
    return refused(UrlImportOutcome.Rejected, refusal);
  }

  const placed = await placeFigmaPlan(ask.store, ask.place, made.plan, ask.at);
  const landed = [...placed.frameIds];
  try {
    const sets = await placedSets(ask, made.sets);
    landed.push(...sets.frameIds.filter(Boolean));
    await homedOnSets(ask.store, placed.frameIds, sets.frameIds, made.homes);
    await homedOnSets(ask.store, sets.frameIds, sets.frameIds, made.setHomes);
    const assets = await imported(ask, made.images);
    await filled(ask, placed.frameIds, made.plan.items, assets);
    await filled(ask, sets.frameIds, made.sets, assets);
    return { outcome: UrlImportOutcome.Ok, frameId: placed.frameIds[0], name: made.name, undo: [...placed.undo, ...sets.undo], skipped: [...placed.skipped, ...sets.skipped], truncated };
  } catch (e) {
    await Promise.all(landed.map((id) => ask.store.remove(id).catch(() => undefined)));
    throw e;
  }
}

function refusalOf(items: UrlPlan['plan']['items']): string | null {
  for (const item of items) {
    const verdict = parseMotionDoc(item.doc);
    if (!verdict.ok) {
      return `${item.name}: ${verdict.error}`;
    }
  }
  return null;
}
