import { z } from 'zod';
import { MAX_SIDE } from '@feega/motion-core/motion/doc';
import { imagesFilled, type ImageAssets } from '$lib/canvas/figma/images';
import { placeFigmaPlan, type FrameStore, type Place } from '$lib/server/motion/move-element';
import type { UndoItem } from '$lib/canvas/undo-plan';
import type { AppTab, OpenAppBrowser } from '$lib/server/web/browser';
import { dismissOverlays } from '$lib/server/web/overlays';
import type { PageTree } from './page-tree';
import { urlPlan, type UrlPlan } from './url-doc';

export enum UrlImportOutcome {
  Ok = 'ok',
  Invalid = 'invalid',
  NotPublic = 'not_public',
  NoBrowser = 'no_browser',
  Failed = 'failed',
  Unreadable = 'unreadable',
  RateLimited = 'rate_limited'
}

export const URL_IMPORT_STATUS: Record<Exclude<UrlImportOutcome, UrlImportOutcome.Ok>, number> = {
  [UrlImportOutcome.Invalid]: 400,
  [UrlImportOutcome.NotPublic]: 400,
  [UrlImportOutcome.NoBrowser]: 503,
  [UrlImportOutcome.Failed]: 502,
  [UrlImportOutcome.Unreadable]: 422,
  [UrlImportOutcome.RateLimited]: 429
};

export type UrlImported = { outcome: UrlImportOutcome.Ok; frameId: string; name: string; undo: UndoItem[]; skipped: string[]; truncated: boolean } | { outcome: Exclude<UrlImportOutcome, UrlImportOutcome.Ok>; error?: string };

export type Planner = { prepare: (tab: AppTab) => Promise<void>; plan: (tree: PageTree, newId: () => string) => UrlPlan | null };

const PLAIN: Planner = { prepare: async () => undefined, plan: urlPlan };

export type PageAsk = {
  url: string;
  at: { x: number; y: number };
  store: FrameStore;
  place: Place;
  open: OpenAppBrowser | null;
  guard: (url: URL) => Promise<void>;
  importImage: (url: string) => Promise<string | null>;
  newId: () => string;
  settleMs?: number;
  planner?: Planner;
};

const SETTLE_MS = 1_200;
const SCROLL_STEP_PX = 640;
const SCROLL_STEPS = Math.ceil(MAX_SIDE / SCROLL_STEP_PX);
const HTTP_ERROR = 400;
const WEB_SCHEMES = ['http:', 'https:'];
const FILLED_SUMMARY = 'Filled page images';

const TREE_SHAPE = z.object({ title: z.string(), url: z.string(), width: z.number().positive(), height: z.number().positive(), truncated: z.boolean(), root: z.object({ type: z.literal('FRAME') }).passthrough() });

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

async function read(tab: AppTab, url: URL, settleMs: number, planner: Planner): Promise<PageTree | UrlImported> {
  const status = await tab.goto(url.toString()).catch(() => null);
  if (status !== null && status >= HTTP_ERROR) {
    return refused(UrlImportOutcome.Failed, `the page answered ${status}`);
  }
  for (let y = 0; y < MAX_SIDE; y += SCROLL_STEP_PX) {
    await tab.scroll({ px: SCROLL_STEP_PX }).catch(() => undefined);
    await pause(settleMs / SCROLL_STEPS);
  }
  await pause(settleMs);
  await tab.scroll({ to: 'top' }).catch(() => undefined);
  await dismissOverlays(tab).catch(() => []);
  await planner.prepare(tab).catch(() => undefined);
  const parsed = TREE_SHAPE.safeParse(await tab.tree().catch(() => null));
  return parsed.success ? (parsed.data as unknown as PageTree) : refused(UrlImportOutcome.Unreadable);
}

async function imported(ask: PageAsk, images: Record<string, string>): Promise<ImageAssets> {
  const entries = await Promise.all(Object.entries(images).map(async ([hash, url]) => [hash, await ask.importImage(url).catch(() => null)] as const));
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
  const planner = ask.planner ?? PLAIN;
  const tree = await read(tab, url, ask.settleMs ?? SETTLE_MS, planner).finally(() => tab.close());
  if ('outcome' in tree) {
    return tree;
  }

  const made = planner.plan(tree, ask.newId);
  if (!made?.plan.items.length) {
    return refused(UrlImportOutcome.Unreadable);
  }

  const placed = await placeFigmaPlan(ask.store, ask.place, made.plan, ask.at);
  const frameId = placed.frameIds[0];
  const assets = await imported(ask, made.images);
  const frame = await ask.store.read(frameId);
  if (frame && Object.keys(assets).length) {
    await ask.store.write(frameId, frame.version, imagesFilled(frame.doc, made.plan.items[0].images, assets), FILLED_SUMMARY);
  }
  return { outcome: UrlImportOutcome.Ok, frameId, name: made.name, undo: placed.undo, skipped: placed.skipped, truncated: tree.truncated };
}
