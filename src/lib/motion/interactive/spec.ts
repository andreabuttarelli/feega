import { clipsOf, type MotionClip, type MotionDoc } from '../doc';
import { TRANSFORM_KEYS, type TransformKey } from '../keyframes';
import { docBook } from '../expression/bake';
import type { LaneData } from '../expression/evaluator';
import { readsInput } from '../expression/inputs';
import { liveTarget } from '../hyperframes/animate';
import { SEPARATOR } from '../precomp';
import { pivotOf, transformAt } from '../parent';
import { apply2d, composeLocal, mul2d, type Affine } from '../affine';
import { BENTO_LAYOUT, bentoCellId, cellFrames, type BentoCard, type CompFrame } from '../bento/model';
import { bentoSlotAt } from '../hyperframes/bento';
import type { HostSpec, HostStep, LiveLane, LiveSpec, Rect } from './live';
import type { Outside } from './settings';
import { lensSpec } from './live-props';
import { LivePaint, type LensSpec } from './paint';

const READS_AUDIO = /\baudio\s*\./;

const isLiveSource = (source: string) => readsInput(source) && !READS_AUDIO.test(source);

export function liveLanes(doc: MotionDoc, parents: ReadonlySet<string> = new Set()): LiveLane[] {
  return clipsOf(doc).flatMap((c) =>
    Object.entries(c.expressions).flatMap(([key, source]) => {
      const target = isLiveSource(source) ? liveTarget(c, key, parents) : null;
      return target ? [{ id: c.id, key, ...target } as LiveLane] : [];
    })
  );
}

function lanesOf(doc: MotionDoc, live: MotionDoc, lanes: LiveLane[]): LaneData[] {
  const book = docBook(doc);
  const liveBook = docBook(live);
  const isLive = new Set(lanes.map((l) => `${l.id}.${l.key}`));
  return clipsOf(doc).flatMap((c) =>
    [...new Set([...TRANSFORM_KEYS, ...Object.keys(c.keyframes), ...Object.keys(live.tracks.flatMap((t) => t.clips).find((l) => l.id === c.id)?.expressions ?? {})])].flatMap((key) => {
      try {
        return [isLive.has(`${c.id}.${key}`) ? liveBook.lane(c.id, key) : book.lane(c.id, key)];
      } catch {
        return [];
      }
    })
  );
}

const DEG = Math.PI / 180;
const PRECISION = 1000;

type Size = { width: number; height: number; fps: number };
type CellRef = { grid: MotionClip; item: number; content: CompFrame | null };
type HostFrame = { m: Affine; clip: Rect | null };

function projected(clip: MotionClip, frame: number, size: Size): Affine {
  const at = (key: TransformKey) => transformAt(clip, key, frame);
  const pose = {
    x: at('x') * size.width,
    y: at('y') * size.height,
    rotateZ: at('rotateZ'),
    scaleX: at('scale') * at('scaleX') * Math.cos(at('rotateY') * DEG),
    scaleY: at('scale') * at('scaleY') * Math.cos(at('rotateX') * DEG)
  };
  return composeLocal(pose, pivotOf(clip, size));
}

function boundsOf(m: Affine, [left, top, width, height]: Rect): Rect {
  const corners = [apply2d(m, [left, top]), apply2d(m, [left + width, top]), apply2d(m, [left, top + height]), apply2d(m, [left + width, top + height])];
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
}

const toFrame = (size: Size, content: CompFrame): Affine => [content.width / size.width, 0, 0, content.height / size.height, 0, 0];
const fromFrame = (size: Size, content: CompFrame): Affine => [size.width / content.width, 0, 0, size.height / content.height, 0, 0];

function cellFrame(cell: CellRef, frame: number, size: Size): HostFrame | null {
  const content = cell.content ?? size;
  const slot = bentoSlotAt(cell.grid, size, cell.item, frame, content);
  if (!slot) {
    return null;
  }
  const grid = projected(cell.grid, frame, size);
  const { x, y, scale } = slot.content;
  return { m: mul2d(mul2d(grid, [scale, 0, 0, scale, x, y]), toFrame(size, content)), clip: boundsOf(grid, [slot.cell.left, slot.cell.top, slot.cell.width, slot.cell.height]) };
}

function cellsOf(doc: MotionDoc): Map<string, CellRef> {
  const cells = new Map<string, CellRef>();
  for (const grid of clipsOf(doc).filter((c) => c.component === 'Composition' && c.props.layout === BENTO_LAYOUT)) {
    ((grid.props.media ?? []) as BentoCard[]).forEach((card, item) => cells.set(bentoCellId(grid.id, item), { grid, item, content: card.kind === 'comp' ? (doc.comps[card.assetId]?.frame ?? null) : null }));
  }
  return cells;
}

const rounded = (frame: HostFrame) => JSON.parse(JSON.stringify(frame, (_k, v) => (typeof v === 'number' ? Math.round(v * PRECISION) / PRECISION : v))) as HostFrame;

function inFrame(clip: MotionClip, frame: number, size: Size, content: CompFrame | null): Affine {
  if (!content) {
    return projected(clip, frame, size);
  }
  return mul2d(mul2d(fromFrame(size, content), projected(clip, frame, { ...size, ...content })), toFrame(size, content));
}

function hostOf(clip: MotionClip, cell: CellRef | undefined, doc: MotionDoc): HostSpec {
  const size = { width: doc.width, height: doc.height, fps: doc.fps };
  const content = cellFrames(doc).find((c) => clip.id.startsWith(c.prefix))?.frame ?? null;
  const frameAt = (frame: number): HostFrame => (cell ? cellFrame(cell, frame, size) : null) ?? { m: inFrame(clip, frame, size, content), clip: null };
  const steps: HostStep[] = [];
  for (let frame = 0; frame <= doc.durationInFrames; frame++) {
    const next = rounded(frameAt(frame));
    const last = steps[steps.length - 1];
    if (last && JSON.stringify([last.m, last.clip]) === JSON.stringify([next.m, next.clip])) {
      continue;
    }
    steps.push({ from: frame, ...next });
  }
  return { steps };
}

function namesOf(doc: MotionDoc): Record<string, string> {
  const names: Record<string, string> = {};
  for (const c of clipsOf(doc)) {
    for (const name of [c.props.name, c.props.text]) {
      if (typeof name === 'string' && !(name in names)) {
        names[name] = c.id;
      }
    }
  }
  return names;
}

export type SpecInput = { live: MotionDoc; baked: MotionDoc; outside: Outside; parents: readonly string[]; color: (v: string) => string };

function lensesOf(baked: MotionDoc, lanes: LiveLane[], color: (v: string) => string): LensSpec[] {
  const ids = new Set(lanes.filter((l) => l.paint === LivePaint.Lens).map((l) => l.id));
  return clipsOf(baked)
    .filter((c) => ids.has(c.id))
    .flatMap((c) => lensSpec(c.component, c, color) ?? []);
}

export function liveSpec(input: SpecInput): LiveSpec {
  const { live, baked } = input;
  const lanes = liveLanes(live, new Set(input.parents));
  const byId = new Map(clipsOf(baked).map((c) => [c.id, c]));
  const cells = cellsOf(baked);
  const hosts = clipsOf(baked).filter((c) => c.component === 'Precomp').map((c) => c.id);
  const chainOf = (id: string) => hosts.filter((h) => id.startsWith(h + SEPARATOR)).sort((a, b) => a.length - b.length);
  const chains = Object.fromEntries(lanes.map((l) => [l.id, chainOf(l.id)]));
  const hostIds = [...new Set(Object.values(chains).flat())];
  return {
    fps: live.fps,
    duration: live.durationInFrames / live.fps,
    width: live.width,
    height: live.height,
    outside: input.outside,
    live: lanes,
    lenses: lensesOf(baked, lanes, input.color),
    lanes: lanesOf(baked, live, lanes),
    order: clipsOf(baked).map((c) => c.id),
    names: namesOf(baked),
    hosts: Object.fromEntries(hostIds.map((id) => [id, hostOf(byId.get(id)!, cells.get(id), baked)])),
    chains
  };
}
