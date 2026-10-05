import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, type OpResult } from '../timeline';
import { sampleTrack } from '../keyframes';
import { Bounds, PHYSICS_PRESETS, PhysicsPreset, type Physics } from './model';
import { applyPhysicsPreset, setPhysics } from './ops';
import { bakePhysics, simulate } from './simulate';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const SIDE = 1080;
const BOX = 0.1;
const HALF = (SIDE * BOX) / 2;
const SECONDS = 4;
const FPS = 30;

function scene(physics: Partial<Physics>, at: { x?: number; y?: number } = {}): MotionDoc {
  const base = { ...newMotionDoc(MotionFormat.Square), durationInFrames: SECONDS * FPS };
  const placed = must(addClip(base, { component: 'Shape', from: 0, durationInFrames: SECONDS * FPS, props: { shape: 'circle', x: at.x ?? 0.5, y: at.y ?? 0.2, width: BOX, height: BOX } }, 'a'));
  return must(setPhysics(placed, 'a', physics));
}

const track = (doc: MotionDoc, id = 'a') => simulate(doc).get(id)!;
const bottoms = (doc: MotionDoc) => track(doc).map((p) => p.y + HALF);

describe('physics simulation', () => {
  it('a dropped clip falls with gravity: half g t squared before it lands', () => {
    const doc = scene({ gravity: 1000, bounds: Bounds.None });
    const after = (seconds: number) => track(doc)[seconds * FPS].y - track(doc)[0].y;

    expect(after(0.5)).toBeCloseTo(0.5 * 1000 * 0.25, -1);
    expect(after(1)).toBeCloseTo(0.5 * 1000, -1);
  });

  it('bounces on the floor without going through it, each bounce lower by the restitution', () => {
    const doc = scene({ gravity: 3000, restitution: 0.5, bounds: Bounds.Floor });
    const ys = bottoms(doc);
    const landings = ys.map((y, f) => [y, f] as const).filter(([y], i) => i > 0 && i < ys.length - 1 && y >= ys[i - 1] && y >= ys[i + 1]);
    const apexes = ys.filter((y, i) => i > 0 && i < ys.length - 1 && y < ys[i - 1] && y <= ys[i + 1]);

    expect(Math.max(...ys)).toBeLessThanOrEqual(SIDE + 0.01);
    expect(landings.length).toBeGreaterThan(1);
    expect(SIDE - apexes[1]).toBeLessThan(SIDE - apexes[0]);
    expect(ys[ys.length - 1]).toBeCloseTo(SIDE, 0);
  });

  it('with no restitution it lands and stays', () => {
    const ys = bottoms(scene({ gravity: 3000, restitution: 0, bounds: Bounds.Floor }));
    const landed = ys.findIndex((y) => y >= SIDE - 0.01);

    expect(ys.slice(landed).every((y) => Math.abs(y - SIDE) < 0.01)).toBe(true);
  });

  it('inside the box a thrown clip bounces off the walls and never leaves the frame', () => {
    const points = track(scene({ gravity: 1500, velocityX: 2500, velocityY: -1500, restitution: 0.8, bounds: Bounds.Box }));

    expect(Math.min(...points.map((p) => p.x - HALF))).toBeGreaterThanOrEqual(-0.01);
    expect(Math.max(...points.map((p) => p.x + HALF))).toBeLessThanOrEqual(SIDE + 0.01);
    expect(Math.min(...points.map((p) => p.y - HALF))).toBeGreaterThanOrEqual(-0.01);
  });

  it('friction on the floor slows a sliding clip to a stop; without it, it keeps going', () => {
    const slide = (friction: number) => track(scene({ gravity: 3000, velocityX: 400, restitution: 0, friction, bounds: Bounds.Floor }, { x: 0.2, y: 0.9 }));
    const rough = slide(0.8);
    const smooth = slide(0);
    const last = rough.length - 1;

    expect(rough[last].x - rough[last - 10].x).toBeCloseTo(0, 3);
    expect(smooth[last].x - smooth[last - 10].x).toBeGreaterThan(100);
  });

  it('two colliding clips do not overlap, and the heavy one barely slows down', () => {
    const base = { ...newMotionDoc(MotionFormat.Square), durationInFrames: SECONDS * FPS };
    const two = must(addClip(must(addClip(base, { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'circle', x: 0.2, y: 0.5, width: BOX, height: BOX } }, 'heavy')), { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'circle', x: 0.6, y: 0.5, width: BOX, height: BOX } }, 'light'));
    const both = must(setPhysics(must(setPhysics(two, 'heavy', { gravity: 0, velocityX: 600, mass: 10, collide: true, bounds: Bounds.None })), 'light', { gravity: 0, mass: 1, collide: true, bounds: Bounds.None }));
    const run = simulate(both);
    const heavy = run.get('heavy')!;
    const light = run.get('light')!;

    expect(heavy.every((p, f) => light[f].x - p.x >= SIDE * BOX - 0.5)).toBe(true);
    expect(heavy[59].x - heavy[58].x).toBeGreaterThan(((600 * 0.7) / FPS));
    expect(light[59].x - light[58].x).toBeGreaterThan(heavy[59].x - heavy[58].x);
  });

  it('is a pure function of the doc: the same doc gives the same frames, whatever was asked before', () => {
    const doc = scene({ gravity: 2500, velocityX: 700, restitution: 0.7, bounds: Bounds.Box });

    expect(simulate(doc)).toEqual(simulate(doc));
    expect(bakePhysics(doc)).toEqual(bakePhysics(doc));
  });
});

describe('physics in the render', () => {
  it('bakes one linear x and y key per frame, so every renderer seeks to the same place', () => {
    const doc = scene({ gravity: 2500, restitution: 0.6, bounds: Bounds.Floor });
    const baked = findClip(bakePhysics(doc), 'a')!.clip;
    const points = track(doc);

    expect(baked.keyframes.y).toHaveLength(SECONDS * FPS);
    expect(baked.keyframes.y.every((k) => k.ease === 'linear')).toBe(true);
    expect(sampleTrack(baked.keyframes.y, 45) * SIDE).toBeCloseTo(points[45].y - SIDE * 0.2, 6);
    expect(baked.physics ?? null).toBeNull();
  });

  it('a clip without physics is left as it is', () => {
    const doc = must(setPhysics(scene({}), 'a', null));

    expect(bakePhysics(doc)).toEqual(doc);
  });
});

describe('physics presets and ops', () => {
  it('drop and bounce, throw and float are one step each', () => {
    const doc = scene({});
    const of = (p: PhysicsPreset) => findClip(must(applyPhysicsPreset(doc, 'a', p)), 'a')!.clip.physics!;

    expect(PHYSICS_PRESETS).toEqual([PhysicsPreset.Drop, PhysicsPreset.Throw, PhysicsPreset.Float]);
    expect(of(PhysicsPreset.Drop)).toMatchObject({ bounds: Bounds.Floor, velocityX: 0 });
    expect(of(PhysicsPreset.Throw).velocityX).toBeGreaterThan(0);
    expect(Math.abs(of(PhysicsPreset.Float).gravity)).toBeLessThan(of(PhysicsPreset.Drop).gravity);
  });

  it('values out of range are refused, null turns physics off', () => {
    expect(setPhysics(scene({}), 'a', { restitution: 3 }).ok).toBe(false);
    expect(findClip(must(setPhysics(scene({}), 'a', null)), 'a')!.clip.physics ?? null).toBeNull();
  });
});
