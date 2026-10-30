import { z } from 'zod';
import { imagesFilled, type ImageAssets } from '$lib/canvas/figma/images';
import { placeFigmaPlan, type FrameStore, type Place } from '$lib/server/motion/move-element';
import type { UndoItem } from '$lib/canvas/undo-plan';
import type { AppTab, OpenAppBrowser } from '$lib/server/web/browser';
import { dismissOverlays } from '$lib/server/web/overlays';
import { SnapMode, TREE_LIMITS, type PageTree } from './page-tree';
import { RevealMode } from './page-reveal';
import type { PageOutline } from './page-outline';
import { sheetFonts, type FetchText } from './sheet-fonts';
import { FULL_SHAPE, fontsWanted, urlPlan, type FontAssets, type PageShape, type UrlPlan } from './url-doc';

export enum UrlImportOutcome {
  Ok = 'ok',
  Invalid = 'invalid',
  NotPublic = 'not_public',
  NoBrowser = 'no_browser',
  Failed = 'failed',
  Unreadable = 'unreadable',
  RateLimited = 'rate_limited'
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
  [UrlImportOutcome.RateLimited]: 429
};

export type UrlImported = { outcome: UrlImportOutcome.Ok; frameId: string; name: string; undo: UndoItem[]; skipped: string[]; truncated: boolean } | { outcome: Exclude<UrlImportOutcome, UrlImportOutcome.Ok>; error?: string };

export type Planner = { prepare: (tab: AppTab) => Promise<void>; plan: (tree: PageTree, newId: () => string, fonts: FontAssets, shape: PageShape) => UrlPlan | null };

export const PLAIN_PLANNER: Planner = { prepare: async () => undefined, plan: (tree, newId, fonts, shape) => urlPlan(tree, newId, undefined, fonts, shape) };

export type PageAsk = {
  url: string;
  at: { x: number; y: number };
  store: FrameStore;
  place: Place;
  open: OpenAppBrowser | null;
  guard: (url: URL) => Promise<void>;
  importImage: (url: string) => Promise<string | null>;
  importFont?: (url: string) => Promise<string | null>;
  fetchText?: FetchText;
  newId: () => string;
  settleMs?: number;
  planner?: Planner;
  maxHeight?: number;
  shape?: PageShape;
};

const SETTLE_MS = 1_200;
const SCROLL_STEP_PX = 700;
const SCROLL_PAUSES = 8;
const NETWORK_IDLE_MS = 6_000;
const HTTP_ERROR = 400;
const WEB_SCHEMES = ['http:', 'https:'];
const FILLED_SUMMARY = 'Filled page images';

const BOX_SHAPE = z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() });

const FONT_SHAPE = z.object({ family: z.string(), weight: z.string(), style: z.string(), url: z.string() });

const SNAP_SHAPE = z.object({ ref: z.string(), box: BOX_SHAPE, mode: z.nativeEnum(SnapMode) });

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
    outline: z.custom<PageOutline>((v) => typeof v === 'object' && v !== null).optional()
  })
  .strict();

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const refused = (outcome: Exclude<UrlImportOutcome, UrlImportOutcome.Ok>, error?: string): UrlImported => ({ outcome, ...(error ? { error } : {}) });

async function publicUrl(raw: string, guard: PageAsk['guard']): Promise<URL | null> {
  const url = URL.canParse(raw) ? new URL(raw) : null;
  if (!url || !WEB_SCHEMES.includes(url.protocol)) {
    return null;
  }
  return guard(url).then(
    () => url,
    () => null
  );
}

export async function pagePrepared(tab: AppTab, url: URL, settleMs: number, planner: Planner, maxHeight = TREE_LIMITS.height): Promise<UrlImported | null> {
  await tab.seeAll().catch(() => undefined);
  const status = await tab.goto(url.toString()).catch(() => null);
  if (status !== null && status >= HTTP_ERROR) {
    return refused(UrlImportOutcome.Failed, `the page answered ${status}`);
  }
  await tab.settle(NETWORK_IDLE_MS);
  const { height } = await tab.reveal(RevealMode.Moving).catch(() => ({ height: TREE_LIMITS.height }));
  const steps = Math.ceil(Math.min(height, maxHeight) / SCROLL_STEP_PX);
  for (let i = 0; i < steps; i++) {
    await tab.scroll({ px: SCROLL_STEP_PX }).catch(() => undefined);
    await pause(settleMs / SCROLL_PAUSES);
  }
  await tab.settle(NETWORK_IDLE_MS);
  await tab.scroll({ to: 'top' }).catch(() => undefined);
  await pause(settleMs);
  await tab.reveal(RevealMode.Moving).catch(() => undefined);
  await dismissOverlays(tab).catch(() => []);
  await planner.prepare(tab).catch(() => undefined);
  await tab.settle(NETWORK_IDLE_MS);
  await pause(settleMs);
  await tab.reveal(RevealMode.Still).catch(() => undefined);
  return null;
}

export async function pageTreeAt(tab: AppTab, url: URL, settleMs: number, planner: Planner, maxHeight?: number): Promise<PageTree | UrlImported> {
  const refusal = await pagePrepared(tab, url, settleMs, planner, maxHeight);
  if (refusal) {
    return refusal;
  }
  const parsed = TREE_SHAPE.safeParse(await tab.tree(maxHeight).catch(() => null));
  return parsed.success ? (parsed.data as unknown as PageTree) : refused(UrlImportOutcome.Unreadable);
}

async function imported(ask: PageAsk, images: Record<string, string>): Promise<ImageAssets> {
  const entries = await Promise.all(Object.entries(images).map(async ([hash, url]) => [hash, await ask.importImage(url).catch(() => null)] as const));
  return Object.fromEntries(entries.filter((e): e is readonly [string, string] => Boolean(e[1])));
}

async function withSheetFonts(ask: PageAsk, tree: PageTree): Promise<PageTree> {
  if (!ask.fetchText || !tree.sheets?.length) {
    return tree;
  }
  return { ...tree, fonts: [...(tree.fonts ?? []), ...(await sheetFonts(tree.sheets, ask.fetchText))] };
}

async function fontsFor(ask: PageAsk, tree: PageTree): Promise<FontAssets> {
  const importFont = ask.importFont;
  if (!importFont) {
    return {};
  }
  const entries = await Promise.all(fontsWanted(tree).map(async (face) => [face.url, await importFont(face.url).catch(() => null)] as const));
  return Object.fromEntries(entries.filter((e): e is readonly [string, string] => Boolean(e[1])));
}

export async function importPageAt(ask: PageAsk): Promise<UrlImported> {
  const url = await publicUrl(ask.url, ask.guard);
  if (!url) {
    return refused(UrlImportOutcome.NotPublic);
  }
  if (!ask.open) {
    return refused(UrlImportOutcome.NoBrowser);
  }

  const tab = await ask.open();
  const planner = ask.planner ?? PLAIN_PLANNER;
  const read = await pageTreeAt(tab, url, ask.settleMs ?? SETTLE_MS, planner, ask.maxHeight).finally(() => tab.close());
  if ('outcome' in read) {
    return read;
  }
  const tree = await withSheetFonts(ask, read);

  const made = planner.plan(tree, ask.newId, await fontsFor(ask, tree), ask.shape ?? FULL_SHAPE);
  if (!made?.plan.items.length) {
    return refused(UrlImportOutcome.Unreadable);
  }

  const placed = await placeFigmaPlan(ask.store, ask.place, made.plan, ask.at);
  const assets = await imported(ask, made.images);
  for (const [i, frameId] of placed.frameIds.entries()) {
    const frame = await ask.store.read(frameId);
    const images = made.plan.items[i]?.images ?? [];
    if (frame && images.length && Object.keys(assets).length) {
      await ask.store.write(frameId, frame.version, imagesFilled(frame.doc, images, assets), FILLED_SUMMARY);
    }
  }
  const frameId = placed.frameIds[0];
  return { outcome: UrlImportOutcome.Ok, frameId, name: made.name, undo: placed.undo, skipped: placed.skipped, truncated: tree.truncated };
}
