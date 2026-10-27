import { planOf } from '$lib/canvas/figma/figma-doc';
import { imagesFilled } from '$lib/canvas/figma/images';
import { placeFigmaPlan, type FigmaFill, type FigmaPasteOutcome, type FrameStore, type Place } from '$lib/server/motion/move-element';
import { figmaUrl } from './file-url';
import { fetchFigmaFrames } from './import-file';
import { FigmaOutcome, MAX_HASHES, importFigmaImages, type FetchFn } from './import-images';
import { restMessage } from './rest-message';

const FILLED_SUMMARY = 'Filled Figma images';

type Ask = {
  store: FrameStore;
  place: Place;
  token: string | null;
  url: string;
  nodeIds: string[] | null;
  at: { x: number; y: number };
  fetchFn: FetchFn;
  importUrl: (url: string) => Promise<string | null>;
  newId: () => string;
};

export type FigmaImported =
  | { outcome: FigmaOutcome.Ok; frameIds: string[]; undo: NonNullable<FigmaPasteOutcome>['undo']; skipped: string[] }
  | { outcome: Exclude<FigmaOutcome, FigmaOutcome.Ok> };

const refused = (outcome: Exclude<FigmaOutcome, FigmaOutcome.Ok>): FigmaImported => ({ outcome });

const chunks = <T>(list: T[], size: number): T[][] => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

async function fillImages(ask: Ask, fileKey: string, token: string, fills: FigmaFill[]): Promise<void> {
  const hashes = [...new Set(fills.flatMap((f) => f.images.map((i) => i.hash)))];
  const stored = await Promise.all(chunks(hashes, MAX_HASHES).map((part) => importFigmaImages({ token, fileKey, hashes: part }, { fetchFn: ask.fetchFn, importUrl: ask.importUrl })));
  const assets = Object.assign({}, ...stored.map((s) => s.assets));

  for (const fill of fills) {
    const frame = await ask.store.read(fill.nodeId);
    if (frame) {
      await ask.store.write(fill.nodeId, frame.version, imagesFilled(frame.doc, fill.images, assets), FILLED_SUMMARY);
    }
  }
}

export async function importFigmaFrames(ask: Ask): Promise<FigmaImported> {
  if (!ask.token) {
    return refused(FigmaOutcome.NoToken);
  }

  const link = figmaUrl(ask.url);
  if (!link) {
    return refused(FigmaOutcome.BadLink);
  }

  const nodeIds = ask.nodeIds ?? (link.nodeId ? [link.nodeId] : []);
  if (!nodeIds.length) {
    return refused(FigmaOutcome.NoFrames);
  }

  const got = await fetchFigmaFrames({ token: ask.token, fileKey: link.fileKey, nodeIds }, ask.fetchFn);
  if (got.outcome !== FigmaOutcome.Ok) {
    return refused(got.outcome);
  }

  const plan = planOf(restMessage(got.frames, link.fileKey), ask.newId);
  if (!plan) {
    return refused(FigmaOutcome.Unreadable);
  }

  const placed = await placeFigmaPlan(ask.store, ask.place, plan, ask.at);
  await fillImages(ask, link.fileKey, ask.token, placed.fills).catch(() => undefined);
  return { outcome: FigmaOutcome.Ok, frameIds: placed.frameIds, undo: placed.undo, skipped: placed.skipped };
}
