import { FrameKind, MOTION_NODE_BAR_H, docKindOf, frameChrome, holdsDoc } from '$lib/canvas/motion-node';
import { posterFrameOf } from '$lib/motion/poster-time';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { ItemKind, type DisplayList, type Item, type Scissor } from '@feega/motion-core/motion/gpu-full/display-list';
import { mul2d, type Affine } from '@feega/motion-core/motion/affine';
import type { Rgba } from '@feega/motion-core/motion/gpu-full/rgba';
import type { Box } from './canvas-scene';

export type FrameTile = { id: string; kind?: string | null; x: number; y: number; w: number; h: number; rotation?: number };
export type FrameData = { kind?: unknown; docHeadRevision?: unknown; linked?: unknown };
export type FrameAt = { id: string; kind: FrameKind; revision: number; linked?: string; scenes?: string; box: Box; turn?: { degrees: number; about: { x: number; y: number } } };

export function framesOnCanvas(tiles: readonly FrameTile[], dataOf: (id: string) => FrameData): FrameAt[] {
  return tiles.flatMap((t) => {
    const type = t.kind ?? '';
    if (!holdsDoc(type)) {
      return [];
    }
    const data = dataOf(t.id);
    const revision = Number(data.docHeadRevision);
    if (!Number.isInteger(revision) || revision <= 0) {
      return [];
    }
    const kind = docKindOf(type, data.kind);
    const bar = frameChrome(kind).bar ? MOTION_NODE_BAR_H : 0;
    const box = { x: t.x, y: t.y, w: t.w, h: t.h - bar };
    const turn = t.rotation ? { turn: { degrees: t.rotation, about: { x: t.x + t.w / 2, y: t.y + t.h / 2 } } } : {};
    const linked = data.linked ? { linked: JSON.stringify(data.linked) } : {};
    return [{ id: t.id, kind, revision, box, ...linked, ...turn }];
  });
}

export const stillFrame = posterFrameOf;

export const frameOfLive = (live: { doc: Parameters<typeof stillFrame>[0]; playhead?: number }): number => live.playhead ?? stillFrame(live.doc);

type Shown = { doc: unknown; tokens: unknown; assets: unknown; playhead?: number };

export const sameLive = (a: Shown | undefined, b: Shown): boolean => Boolean(a) && a!.doc === b.doc && a!.tokens === b.tokens && a!.assets === b.assets && a!.playhead === b.playhead;

export const toFetch = <F extends { id: string }>(frames: readonly F[], keyOf: (f: F) => string, asked: ReadonlySet<string>, drawnLive: { has: (id: string) => boolean }): F[] =>
  frames.filter((f) => !asked.has(keyOf(f)) && !drawnLive.has(f.id));

export const fetchKey = (f: { id: string; revision: number }) => `${f.id}:${f.revision}`;

export const pickedToFetch = <F extends { id: string; revision: number }>(frames: readonly F[], picked: readonly string[], fetched: ReadonlyMap<string, number>, rushed: ReadonlySet<string>): F[] =>
  frames.filter((f) => picked.includes(f.id) && fetched.get(f.id) !== f.revision && !rushed.has(fetchKey(f)));

export const shownGroup = (current: string, previous: string | undefined, built: (group: string) => boolean): string | null => {
  if (built(current)) {
    return current;
  }
  return previous && built(previous) ? previous : null;
};

export const drawsAny = (list: DisplayList): boolean => list.items.length > 0;

export function logGaps(id: string, list: DisplayList) {
  if (!list.unsupported.length) {
    return;
  }
  console.warn('[canvas] core left out of frame', id, list.unsupported.map((g) => `${g.clip} (${g.component}): ${g.detail ?? g.reason}`).join('; '));
}

enum Edge {
  Clips = 'clips',
  Bleeds = 'bleeds'
}

const STAGE: Record<FrameKind, { background: Rgba | null; edge: Edge }> = {
  [FrameKind.Frame]: { background: [0, 0, 0, 1], edge: Edge.Clips },
  [FrameKind.Element]: { background: null, edge: Edge.Bleeds },
  [FrameKind.Group]: { background: null, edge: Edge.Bleeds }
};

function moved(item: Item, by: number): Item {
  const m: Affine = [1, 0, 0, 1, by, by];
  const masks = item.masks?.map((l) => ({ ...l, cover: { ...l.cover, matrix: mul2d(m, l.cover.matrix) } }));
  const matte = item.matte && { ...item.matte, items: item.matte.items.map((i) => moved(i, by)) };
  return {
    ...item,
    matrix: mul2d(m, item.matrix),
    ...(item.scissor ? { scissor: item.scissor.map((v) => v + by) as Scissor } : {}),
    ...(masks ? { masks } : {}),
    ...(matte ? { matte } : {}),
    ...(item.kind === ItemKind.Group ? { items: item.items.map((i) => moved(i, by)) } : {}),
    ...(item.origin ? { origin: [item.origin[0] + by, item.origin[1] + by] } : {})
  } as Item;
}

function bled(list: DisplayList, bleed: number): DisplayList {
  return { ...list, width: list.width + 2 * bleed, height: list.height + 2 * bleed, items: list.items.map((i) => moved(i, bleed)), bleed };
}

export function onStage(list: DisplayList, kind: FrameKind): DisplayList {
  const stage = STAGE[kind];
  const { bleed = 0, ...flat } = list;
  const shown = { ...flat, background: list.background ?? stage.background };
  return stage.edge === Edge.Bleeds && bleed > 0 ? bled(shown, bleed) : shown;
}

export function stagedBox(box: Box, list: DisplayList): Box {
  const bleed = list.bleed ?? 0;
  const sx = box.w / (list.width - 2 * bleed);
  const sy = box.h / (list.height - 2 * bleed);
  return bleed ? { x: box.x - bleed * sx, y: box.y - bleed * sy, w: box.w + 2 * bleed * sx, h: box.h + 2 * bleed * sy } : box;
}

export type Patience = { tries: number; waitMs: number };

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function untilFound<T>(attempt: () => Promise<T | null>, { tries, waitMs }: Patience, wait: (ms: number) => Promise<void> = pause): Promise<T | null> {
  for (let tried = 1; ; tried++) {
    const found = await attempt();
    if (found !== null || tried >= tries) {
      return found;
    }
    await wait(waitMs);
  }
}

export const frameSourceUrl = (sourceUrl: (id: string) => string, f: FrameAt): string => `${sourceUrl(f.id)}?${new URLSearchParams({ revision: String(f.revision), ...(f.linked ? { linked: f.linked } : {}) })}`;
