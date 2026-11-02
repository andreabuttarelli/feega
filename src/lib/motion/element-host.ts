import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
import { pivotBox } from '@feega/motion-core/motion/parent';
import { withAutoLayout } from '@feega/motion-core/motion/layout/resolve';
import { holdPixels } from './layout/stack-fit';
import { wrapAngle } from '$lib/canvas/node-layout';

export type HostBox = { x: number; y: number; w: number; h: number; rotation: number };

export type ElementHost = { clipId: string; box: HostBox; move: (x: number, y: number) => void; resize: (w: number, h: number) => void; turn: (degrees: number) => void };

const SAME_PX = 0.01;

export const sameBox = (a: HostBox, b: HostBox): boolean => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.w - b.w), Math.abs(a.h - b.h), Math.abs(a.rotation - b.rotation)) < SAME_PX;

export type Settled = { doc: MotionDoc; box: HostBox };

export enum Ratio {
  Free = 'free',
  Locked = 'locked'
}

type Side = 'w' | 'h';

const SIDE_OF_KEY: Record<string, Side> = { width: 'w', height: 'h' };
const ACROSS: Record<Side, Side> = { w: 'h', h: 'w' };

export const sideOf = (key: string): Side => SIDE_OF_KEY[key] ?? 'w';

export function resizedSide(box: Pick<HostBox, 'w' | 'h'>, side: Side, length: number, ratio: Ratio): { w: number; h: number } {
  const across = ACROSS[side];
  const follows = ratio === Ratio.Locked ? (box[across] * length) / box[side] : box[across];
  return { [side]: length, [across]: follows } as { w: number; h: number };
}

export class HostLedger {
  private readonly boxes = new WeakMap<MotionDoc, HostBox>();

  leave(doc: MotionDoc, box: HostBox) {
    this.boxes.set(doc, box);
  }

  arrive(doc: MotionDoc, box: HostBox): HostBox | null {
    const kept = this.boxes.get(doc);
    return kept && !sameBox(kept, box) ? kept : null;
  }
}

type Area = { left: number; top: number; width: number; height: number };
type Point = { x: number; y: number };
type Size = { width: number; height: number };

const SLACK_PX = 0.5;
const GEOMETRY = ['x', 'y', 'width', 'height', 'rotateZ'] as const;
const FILL = { x: 0.5, y: 0.5, width: 1, height: 1 };
const DEGREE = Math.PI / 180;

enum Footprint {
  Own = 'own',
  Laid = 'laid'
}

const laidRoot = (doc: MotionDoc, root: MotionClip) => withAutoLayout(doc).tracks.flatMap((t) => t.clips).find((c) => c.id === root.id) ?? root;

const FOOTPRINT: Record<Footprint, { area: (doc: MotionDoc, root: MotionClip) => Area; resizes: boolean }> = {
  [Footprint.Own]: { area: (doc, root) => pivotBox(root.props, doc), resizes: true },
  [Footprint.Laid]: { area: (doc, root) => ({ ...pivotBox(laidRoot(doc, root).props, doc), width: doc.width, height: doc.height }), resizes: false }
};

const footprintOf = (root: MotionClip): Footprint => (root.autoLayout ? Footprint.Laid : Footprint.Own);

const rootsOf = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips as MotionClip[]).filter((c) => !c.parent);

const animated = (clip: MotionClip) => GEOMETRY.some((key) => clip.keyframes[key]?.length);

const turned = (p: Point, degrees: number): Point => {
  const [cos, sin] = [Math.cos(degrees * DEGREE), Math.sin(degrees * DEGREE)];
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos };
};

const offsetArea = (area: Area, root: MotionClip, stage: Size): Area => ({ ...area, left: area.left + (root.transform.x ?? 0) * stage.width, top: area.top + (root.transform.y ?? 0) * stage.height });

const fills = (area: Area, stage: Size) => Math.max(Math.abs(area.left), Math.abs(area.top), Math.abs(area.width - stage.width), Math.abs(area.height - stage.height)) <= SLACK_PX;

const centreOf = (area: Area): Point => ({ x: area.left + area.width / 2, y: area.top + area.height / 2 });

function placedBox(box: HostBox, area: Area, centre: Point, stage: Size, degrees: number): HostBox {
  const scale = { x: box.w / stage.width, y: box.h / stage.height };
  const shift = turned({ x: (centre.x - stage.width / 2) * scale.x, y: (centre.y - stage.height / 2) * scale.y }, box.rotation);
  const [w, h] = [area.width * scale.x, area.height * scale.y];
  return { x: box.x + box.w / 2 + shift.x - w / 2, y: box.y + box.h / 2 + shift.y - h / 2, w, h, rotation: wrapAngle(box.rotation + degrees) };
}

const shiftedClip = (clip: MotionClip, by: Point): MotionClip => {
  const { x, y } = clip.props as { x?: unknown; y?: unknown };
  return typeof x === 'number' && typeof y === 'number' ? { ...clip, props: { ...clip.props, x: x - by.x, y: y - by.y } } : clip;
};

const mapClips = (doc: MotionDoc, f: (clip: MotionClip) => MotionClip): MotionDoc => ({ ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => f(c as MotionClip)) })) });

const upright = (clip: MotionClip): MotionClip => ({ ...clip, transform: { ...clip.transform, rotateZ: 0, x: 0, y: 0 } });

const stageOf = (area: Area): Size => ({ width: Math.max(1, Math.round(area.width)), height: Math.max(1, Math.round(area.height)) });

function restaged(doc: MotionDoc, root: MotionClip, area: Area, resizes: boolean): MotionDoc {
  const shifted = mapClips(doc, (c) => shiftedClip(c, { x: area.left / doc.width, y: area.top / doc.height }));
  const sized = resizes ? holdPixels(shifted, stageOf(area)) : shifted;
  return mapClips(sized, (c) => (c.id !== root.id ? c : upright(resizes ? { ...c, props: { ...c.props, ...FILL } } : c)));
}

type Footing = { root: MotionClip; area: Area; degrees: number; resizes: boolean };

function footingOf(doc: MotionDoc): Footing | null {
  const [root, ...rest] = rootsOf(doc);
  if (!root || rest.length || animated(root)) {
    return null;
  }
  const rule = FOOTPRINT[footprintOf(root)];
  const area = offsetArea(rule.area(doc, root), root, doc);
  const degrees = root.transform.rotateZ ?? 0;
  return degrees || !fills(area, doc) ? { root, area, degrees, resizes: rule.resizes } : null;
}

export const unsettled = (doc: MotionDoc): boolean => footingOf(doc) !== null;

export function settleElement(doc: MotionDoc, box: HostBox): Settled | null {
  const footing = footingOf(doc);
  if (!footing) {
    return null;
  }
  const { root, area, degrees, resizes } = footing;
  return { doc: restaged(doc, root, area, resizes), box: placedBox(box, area, centreOf(area), doc, degrees) };
}
