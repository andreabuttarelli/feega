import { FillType, type Fill, type FillOf } from '$lib/motion/fill/model';
import { elementFills } from '$lib/motion/fill/elements';
import { findClip, type MotionDoc } from '$lib/motion/doc';
import { setProps, type OpResult } from '$lib/motion/timeline';

export type Pt = [number, number];
export type Size = { width: number; height: number };
export type Handles = { start: Pt; end: Pt; stops: Pt[] };

export enum GradientGrip {
  Start = 'start',
  End = 'end',
  Stop = 'stop'
}

export type Grab = { grip: GradientGrip.Start | GradientGrip.End } | { grip: GradientGrip.Stop; stop: number };

type Stops = { stops: { color: string; pos: number }[] };

const DEG = Math.PI / 180;
const HALF = 0.5;
const MIN_RADIUS = 0.01;
const MAX_RADIUS = 4;

const clampUnit = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const degreesOf = (from: Pt, to: Pt) => Math.atan2(to[1] - from[1], to[0] - from[0]) / DEG;
const centreOf = (size: Size): Pt => [size.width * HALF, size.height * HALF];
const along = (start: Pt, end: Pt, p: Pt) => {
  const [dx, dy] = [end[0] - start[0], end[1] - start[1]];
  const length = dx * dx + dy * dy || 1;
  return clampUnit(((p[0] - start[0]) * dx + (p[1] - start[1]) * dy) / length);
};
const stopsAlong = (f: Stops, start: Pt, end: Pt) => f.stops.map((s) => lerp(start, end, s.pos));
const withStop = <F extends Stops>(f: F, i: number, pos: number): F => ({ ...f, stops: f.stops.map((s, k) => (k === i ? { ...s, pos } : s)) });

type Geometry<T extends FillType> = {
  handles: (f: FillOf<T>, size: Size) => Handles;
  drag: (f: FillOf<T>, size: Size, grab: Grab, p: Pt) => FillOf<T>;
};

function linearEnds(f: FillOf<FillType.Linear>, size: Size): [Pt, Pt] {
  const [dx, dy] = [Math.cos(f.angle * DEG), Math.sin(f.angle * DEG)];
  const reach = (Math.abs(size.width * dx) + Math.abs(size.height * dy)) * HALF;
  const [cx, cy] = centreOf(size);
  return [
    [cx - dx * reach, cy - dy * reach],
    [cx + dx * reach, cy + dy * reach]
  ];
}

function radialEnds(f: FillOf<FillType.Radial>, size: Size): [Pt, Pt] {
  const centre: Pt = [f.center.x * size.width, f.center.y * size.height];
  return [centre, [centre[0] + f.radius * HALF * size.width, centre[1]]];
}

function angularEnds(f: FillOf<FillType.Angular>, size: Size): [Pt, Pt] {
  const centre: Pt = [f.center.x * size.width, f.center.y * size.height];
  const arm = Math.min(size.width, size.height) * HALF;
  const turn = (f.angle - 90) * DEG;
  return [centre, [centre[0] + Math.cos(turn) * arm, centre[1] + Math.sin(turn) * arm]];
}

const movedCentre = (size: Size, p: Pt) => ({ x: clampUnit(p[0] / size.width), y: clampUnit(p[1] / size.height) });

const GEOMETRY: Partial<{ [T in FillType]: Geometry<T> }> = {
  [FillType.Linear]: {
    handles: (f, size) => {
      const [start, end] = linearEnds(f, size);
      return { start, end, stops: stopsAlong(f, start, end) };
    },
    drag: (f, size, grab, p) => {
      const [start, end] = linearEnds(f, size);
      const centre = centreOf(size);
      const turns = { [GradientGrip.Start]: () => ({ ...f, angle: degreesOf(p, centre) }), [GradientGrip.End]: () => ({ ...f, angle: degreesOf(centre, p) }) };
      return grab.grip === GradientGrip.Stop ? withStop(f, grab.stop, along(start, end, p)) : turns[grab.grip]();
    }
  },
  [FillType.Radial]: {
    handles: (f, size) => {
      const [start, end] = radialEnds(f, size);
      return { start, end, stops: stopsAlong(f, start, end) };
    },
    drag: (f, size, grab, p) => {
      const [start, end] = radialEnds(f, size);
      const grips = {
        [GradientGrip.Start]: () => ({ ...f, center: movedCentre(size, p) }),
        [GradientGrip.End]: () => ({ ...f, radius: Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, (2 * Math.hypot(p[0] - start[0], p[1] - start[1])) / size.width)) })
      };
      return grab.grip === GradientGrip.Stop ? withStop(f, grab.stop, along(start, end, p)) : grips[grab.grip]();
    }
  },
  [FillType.Angular]: {
    handles: (f, size) => {
      const [start, end] = angularEnds(f, size);
      return { start, end, stops: [] };
    },
    drag: (f, size, grab, p) => {
      const [start] = angularEnds(f, size);
      return grab.grip === GradientGrip.Start ? { ...f, center: movedCentre(size, p) } : { ...f, angle: degreesOf(start, p) + 90 };
    }
  }
};

export const gradientHandles = (fill: Fill, size: Size): Handles | null => (GEOMETRY[fill.type] as Geometry<FillType> | undefined)?.handles(fill as never, size) ?? null;

export function draggedFill(fill: Fill, size: Size, grab: Grab, p: Pt): Fill {
  const geometry = GEOMETRY[fill.type] as Geometry<FillType> | undefined;
  return geometry ? (geometry.drag(fill as never, size, grab, p) as Fill) : fill;
}

const fillsOf = (doc: MotionDoc, clipId: string): Fill[] => {
  const clip = findClip(doc, clipId)?.clip;
  return clip ? elementFills(clip.component, clip.props) : [];
};

export function gradientTarget(doc: MotionDoc, clipId: string): { index: number; fill: Fill } | null {
  const fills = fillsOf(doc, clipId);
  const index = fills.findLastIndex((f) => f.visible && GEOMETRY[f.type] !== undefined);
  return index < 0 ? null : { index, fill: fills[index] };
}

export const withFill = (doc: MotionDoc, clipId: string, index: number, fill: Fill): OpResult => setProps(doc, clipId, { fills: fillsOf(doc, clipId).map((f, i) => (i === index ? fill : f)) });
