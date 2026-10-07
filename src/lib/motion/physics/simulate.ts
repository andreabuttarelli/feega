import { Ease } from '../design';
import { sampleTrack, type Keyframe, type Keyframes, type Transform } from '../keyframes';
import { Bounds, type Physics } from './model';

export type Point = { x: number; y: number };

type Frame = { width: number; height: number; fps: number };
type SimClip = { id: string; from: number; durationInFrames: number; props: Record<string, unknown>; transform: Transform; keyframes: Keyframes; physics?: Physics | null };
type SimDoc = Frame & { durationInFrames: number; tracks: { clips: SimClip[] }[] };

type Body = { id: string; from: number; to: number; half: Point; p: Point; v: Point; inverseMass: number; physics: Physics };

const SUBSTEPS = 8;
const REST_SPEED = 30;
const STOP_SPEED = 1;
const FRICTION_RATE = 10;
const CENTRE = 0.5;
const FULL = 1;

enum Axis {
  X = 'x',
  Y = 'y'
}

const SIZE_OF: Record<Axis, (f: Frame) => number> = { [Axis.X]: (f) => f.width, [Axis.Y]: (f) => f.height };
const ACROSS: Record<Axis, Axis> = { [Axis.X]: Axis.Y, [Axis.Y]: Axis.X };
const SIZE_PROP: Record<Axis, string> = { [Axis.X]: 'width', [Axis.Y]: 'height' };
const SCALE_KEY: Record<Axis, 'scaleX' | 'scaleY'> = { [Axis.X]: 'scaleX', [Axis.Y]: 'scaleY' };

const numberOr = (value: unknown, fallback: number) => (typeof value === 'number' ? value : fallback);

function offsetAt(clip: SimClip, axis: Axis, local: number): number {
  const track = clip.keyframes[axis];
  return track?.length ? Number(sampleTrack(track, local)) : (clip.transform[axis] ?? 0);
}

function bodyOf(clip: SimClip, physics: Physics, frame: Frame): Body {
  const scale = (axis: Axis) => (clip.transform.scale ?? FULL) * Math.abs(clip.transform[SCALE_KEY[axis]] ?? FULL);
  const half = (axis: Axis) => (numberOr(clip.props[SIZE_PROP[axis]], FULL) * SIZE_OF[axis](frame) * scale(axis)) / 2;
  const centre = (axis: Axis) => (numberOr(clip.props[axis], CENTRE) + offsetAt(clip, axis, 0)) * SIZE_OF[axis](frame);
  return {
    id: clip.id,
    from: clip.from,
    to: clip.from + clip.durationInFrames,
    half: { x: half(Axis.X), y: half(Axis.Y) },
    p: { x: centre(Axis.X), y: centre(Axis.Y) },
    v: { x: physics.velocityX, y: physics.velocityY },
    inverseMass: 1 / physics.mass,
    physics
  };
}

const WALLS: Record<Bounds, readonly { axis: Axis; side: 1 | -1 }[]> = {
  [Bounds.None]: [],
  [Bounds.Floor]: [{ axis: Axis.Y, side: 1 }],
  [Bounds.Box]: [
    { axis: Axis.Y, side: 1 },
    { axis: Axis.Y, side: -1 },
    { axis: Axis.X, side: 1 },
    { axis: Axis.X, side: -1 }
  ]
};

function rub(b: Body, along: Axis, dt: number) {
  const kept = b.v[along] * Math.max(0, 1 - b.physics.friction * FRICTION_RATE * dt);
  b.v[along] = Math.abs(kept) < STOP_SPEED ? 0 : kept;
}

function bounce(b: Body, frame: Frame, dt: number) {
  for (const { axis, side } of WALLS[b.physics.bounds]) {
    const limit = side > 0 ? SIZE_OF[axis](frame) - b.half[axis] : b.half[axis];
    if ((b.p[axis] - limit) * side < 0) {
      continue;
    }
    b.p[axis] = limit;
    if (b.v[axis] * side > 0) {
      const back = -b.v[axis] * b.physics.restitution;
      b.v[axis] = Math.abs(back) < REST_SPEED ? 0 : back;
    }
    rub(b, ACROSS[axis], dt);
  }
}

function collide(a: Body, b: Body) {
  const dx = b.p.x - a.p.x;
  const dy = b.p.y - a.p.y;
  const ox = a.half.x + b.half.x - Math.abs(dx);
  const oy = a.half.y + b.half.y - Math.abs(dy);
  if (ox <= 0 || oy <= 0) {
    return;
  }
  const axis = ox < oy ? Axis.X : Axis.Y;
  const overlap = Math.min(ox, oy);
  const n = (axis === Axis.X ? dx : dy) < 0 ? -1 : 1;
  const total = a.inverseMass + b.inverseMass;
  a.p[axis] -= (n * overlap * a.inverseMass) / total;
  b.p[axis] += (n * overlap * b.inverseMass) / total;

  const closing = (b.v[axis] - a.v[axis]) * n;
  if (closing >= 0) {
    return;
  }
  const restitution = Math.min(a.physics.restitution, b.physics.restitution);
  const impulse = (-(1 + restitution) * closing) / total;
  a.v[axis] -= impulse * a.inverseMass * n;
  b.v[axis] += impulse * b.inverseMass * n;
}

function step(bodies: Body[], frame: Frame, dt: number) {
  for (const b of bodies) {
    b.v.y += b.physics.gravity * dt;
    b.p.x += b.v.x * dt;
    b.p.y += b.v.y * dt;
    bounce(b, frame, dt);
  }
  const colliding = bodies.filter((b) => b.physics.collide);
  for (let i = 0; i < colliding.length; i++) {
    for (let j = i + 1; j < colliding.length; j++) {
      collide(colliding[i], colliding[j]);
    }
  }
}

const physicsClips = (doc: SimDoc) => doc.tracks.flatMap((t) => t.clips).filter((c): c is SimClip & { physics: Physics } => !!c.physics);

export function simulate(doc: SimDoc): Map<string, Point[]> {
  const clips = physicsClips(doc);
  const out = new Map<string, Point[]>(clips.map((c) => [c.id, []]));
  const dt = 1 / (doc.fps * SUBSTEPS);
  const end = Math.max(0, ...clips.map((c) => c.from + c.durationInFrames));
  const live: Body[] = [];

  for (let f = 0; f < end; f++) {
    live.push(...clips.filter((c) => c.from === f).map((c) => bodyOf(c, c.physics, doc)));
    const active = live.filter((b) => f < b.to);
    for (const b of active) {
      out.get(b.id)!.push({ x: b.p.x, y: b.p.y });
    }
    for (let s = 0; s < SUBSTEPS; s++) {
      step(active, doc, dt);
    }
  }
  return out;
}

function dense(count: number, value: (local: number) => number): Keyframe[] {
  return Array.from({ length: count }, (_, local) => ({ frame: local, value: value(local), ease: Ease.Linear }));
}

export function bakePhysics<D extends SimDoc>(doc: D): D {
  const tracks = simulate(doc);
  if (!tracks.size) {
    return doc;
  }
  const baked = (clip: SimClip): SimClip => {
    const points = tracks.get(clip.id);
    if (!points) {
      return clip;
    }
    const moved = (axis: Axis) => dense(points.length, (local) => offsetAt(clip, axis, local) + (points[local][axis] - points[0][axis]) / SIZE_OF[axis](doc));
    return { ...clip, keyframes: { ...clip.keyframes, x: moved(Axis.X), y: moved(Axis.Y) }, physics: null };
  };
  return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map(baked) })) };
}
