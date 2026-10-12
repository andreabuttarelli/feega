import { describe, expect, it } from 'vitest';
import { CAROUSEL_MODEL } from './model';

type Slot = { x: number; z: number; angle: number; scale: number; opacity: number; shade: number };
type Model = {
  wrapOffset: (i: number, pos: number, n: number) => number;
  ringStep: (p: object) => number;
  ringSlot: (d: number, p: object) => Slot;
  sequencePos: (t: number, p: object) => number;
  captionAt: (pos: number, n: number) => { index: number; opacity: number };
  snapTarget: (pos: number, velocity: number) => number;
  glide: (from: number, to: number, elapsed: number, seconds: number, ease: string) => number;
  dragPos: (start: number, dx: number, spacing: number) => number;
};

const model = new Function(`${CAROUSEL_MODEL}; return { wrapOffset, ringStep, ringSlot, sequencePos, captionAt, snapTarget, glide, dragPos };`)() as Model;

const PARAMS = { itemSize: 0.56, aspect: 0.75, gap: 0.14, ringRadius: 0.8, visible: 7, dim: 0.7, lift: 0.06, interval: 2.4, moveSeconds: 1.1, direction: 'next' };
const FPS = 30;
const times = (until: number) => Array.from({ length: Math.round(until * FPS) + 1 }, (_, i) => i / FPS);

describe('the ring', () => {
  it('wraps every item to its shortest way round the ring', () => {
    expect(model.wrapOffset(0, 0, 8)).toBe(0);
    expect(model.wrapOffset(7, 0, 8)).toBe(-1);
    expect(model.wrapOffset(1, 7.5, 8)).toBeCloseTo(1.5);
    expect(model.wrapOffset(3, 0.25, 8)).toBeCloseTo(2.75);
    Array.from({ length: 8 }, (_, i) => expect(Math.abs(model.wrapOffset(i, 2.3, 8))).toBeLessThanOrEqual(4));
  });

  it('keeps the front item centred, largest and undimmed', () => {
    const front = model.ringSlot(0, PARAMS);
    const side = model.ringSlot(1, PARAMS);

    expect(front.x).toBeCloseTo(0);
    expect(front.z).toBeCloseTo(0);
    expect(front.shade).toBe(0);
    expect(front.scale).toBeGreaterThan(side.scale);
    expect(side.z).toBeLessThan(0);
    expect(side.shade).toBeGreaterThan(0);
  });

  it('places items on one circle, mirrored on each side', () => {
    const r = PARAMS.ringRadius;
    [-2, -1, 1, 2].forEach((d) => {
      const s = model.ringSlot(d, PARAMS);
      expect(Math.hypot(s.x, s.z + r)).toBeCloseTo(r, 6);
      expect(s.x).toBeCloseTo(-model.ringSlot(-d, PARAMS).x, 6);
      expect(s.angle).toBeCloseTo(d * model.ringStep(PARAMS), 6);
    });
  });

  it('spaces neighbours by the item width plus the gap', () => {
    const one = model.ringSlot(1, PARAMS);
    const width = PARAMS.itemSize * PARAMS.aspect;

    expect(Math.hypot(one.x, one.z)).toBeCloseTo(width * (1 + PARAMS.gap), 6);
  });

  it('shows the visible count and hides the rest, dimming more the further back', () => {
    const half = (PARAMS.visible - 1) / 2;
    const slots = [0, 1, 2, 3, 4].map((d) => model.ringSlot(d, PARAMS));

    expect(slots.slice(0, half + 1).every((s) => s.opacity === 1)).toBe(true);
    expect(model.ringSlot(half + 1, PARAMS).opacity).toBe(0);
    slots.slice(1).forEach((s, i) => expect(s.shade).toBeGreaterThan(slots[i].shade));
  });
});

describe('the video sequence', () => {
  it('holds on an item, then advances one step per interval', () => {
    expect(model.sequencePos(0, PARAMS)).toBe(0);
    expect(model.sequencePos(PARAMS.interval - PARAMS.moveSeconds - 0.01, PARAMS)).toBe(0);
    expect(model.sequencePos(PARAMS.interval, PARAMS)).toBeCloseTo(1, 9);
    expect(model.sequencePos(3 * PARAMS.interval, PARAMS)).toBeCloseTo(3, 9);
  });

  it('only ever moves forward: no overshoot, no step back', () => {
    const seq = times(10).map((t) => model.sequencePos(t, PARAMS));

    seq.slice(1).forEach((p, i) => expect(p).toBeGreaterThanOrEqual(seq[i] - 1e-12));
    expect(Math.max(...seq)).toBeLessThanOrEqual(Math.floor(10 / PARAMS.interval) + 1e-9);
  });

  it('turns the other way when told', () => {
    expect(model.sequencePos(2 * PARAMS.interval, { ...PARAMS, direction: 'previous' })).toBeCloseTo(-2, 9);
  });

  it('is a pure function of t: any seek order gives the same position', () => {
    const at = [0.3, 2.2, 6.4, 9.8, 1.1];
    const forward = at.map((t) => model.sequencePos(t, PARAMS));
    const backward = [...at].reverse().map((t) => model.sequencePos(t, PARAMS)).reverse();

    expect(backward).toEqual(forward);
  });

  it('eases in-out: slow at both ends of a move, fastest in the middle', () => {
    const start = PARAMS.interval - PARAMS.moveSeconds;
    const speed = (f: number) => model.sequencePos(start + f * PARAMS.moveSeconds + 0.01, PARAMS) - model.sequencePos(start + f * PARAMS.moveSeconds, PARAMS);

    expect(speed(0.5)).toBeGreaterThan(speed(0.1) * 10);
    expect(speed(0.5)).toBeGreaterThan(speed(0.9) * 10);
  });

  it('shows the caption of the item in front, faded out while moving', () => {
    expect(model.captionAt(0, 8)).toEqual({ index: 0, opacity: 1 });
    expect(model.captionAt(-1, 8).index).toBe(7);
    expect(model.captionAt(9, 8).index).toBe(1);
    expect(model.captionAt(2.5, 8).opacity).toBe(0);
  });
});

describe('the interaction', () => {
  it('drags the ring with the pointer: one spacing of travel is one item', () => {
    expect(model.dragPos(3, -200, 200)).toBeCloseTo(4);
    expect(model.dragPos(3, 100, 200)).toBeCloseTo(2.5);
  });

  it('snaps a slow release to the nearest item', () => {
    expect(model.snapTarget(3.3, 0)).toBe(3);
    expect(model.snapTarget(3.6, 0.1)).toBe(4);
    expect(model.snapTarget(-1.4, 0)).toBe(-1);
  });

  it('carries a flick forward, never back against the motion', () => {
    expect(model.snapTarget(3.1, 4)).toBeGreaterThanOrEqual(4);
    expect(model.snapTarget(3.9, -4)).toBeLessThanOrEqual(3);
    expect(model.snapTarget(3.05, 0.8)).toBe(4);
  });

  it('glides monotonically to the target and lands exactly on it', () => {
    ['inout', 'out'].forEach((ease) => {
      const path = Array.from({ length: 61 }, (_, i) => model.glide(2, 5, i / 60, 1, ease));

      path.slice(1).forEach((p, i) => expect(p).toBeGreaterThanOrEqual(path[i]));
      expect(path[0]).toBe(2);
      expect(path[60]).toBe(5);
      expect(model.glide(2, 5, 3, 1, ease)).toBe(5);
    });
  });

  it('a button press is one step, two presses are two', () => {
    const one = model.glide(0, 1, 1.1, 1.1, 'inout');
    const two = model.glide(one, one + 1, 1.1, 1.1, 'out');

    expect(two).toBe(2);
  });
});
