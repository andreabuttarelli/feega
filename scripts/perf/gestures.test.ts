import { describe, expect, it } from 'vitest';
import { Ease, FRAME_MS, WHEEL_ZOOM, dragPan, panPath, zoomPath, type Step } from './gestures';

const zoomAfter = (z0: number, steps: Step[]) => steps.filter((s) => s.ctrl).reduce((z, s) => z * Math.exp(-s.dy * WHEEL_ZOOM), z0);
const moved = (steps: Step[]) => steps.filter((s) => !s.ctrl).reduce((p, s) => ({ x: p.x + s.dx, y: p.y + s.dy }), { x: 0, y: 0 });

describe('zoomPath', () => {
  it('lands on every waypoint through small wheel deltas, one or more per display frame', () => {
    const steps = zoomPath({ from: 0.5, legs: [{ to: 0.1, ms: 1500 }, { to: 4, ms: 2500 }], anchor: { x: 700, y: 450 } });

    expect(zoomAfter(0.5, steps)).toBeCloseTo(4, 3);
    expect(Math.max(...steps.map((s) => Math.abs(s.dy)))).toBeLessThan(10);
    expect(steps.every((s, i) => i === 0 || s.at - steps[i - 1].at <= FRAME_MS + 1e-9)).toBe(true);
  });

  it('eases in and out instead of jumping at full speed', () => {
    const steps = zoomPath({ from: 1, legs: [{ to: 2, ms: 1000 }], anchor: { x: 0, y: 0 } });
    const middle = steps[Math.floor(steps.length / 2)];

    expect(Math.abs(steps[0].dy)).toBeLessThan(Math.abs(middle.dy) / 4);
    expect(Math.abs(steps.at(-1)!.dy)).toBeLessThan(Math.abs(middle.dy) / 4);
  });

  it('flicks: most of the change lands in the first frames, then a short tail', () => {
    const steps = zoomPath({ from: 0.1, legs: [{ to: 4, ms: 600 }], anchor: { x: 0, y: 0 }, ease: Ease.Flick });
    const firstThird = steps.slice(0, Math.ceil(steps.length / 3));

    expect(zoomAfter(0.1, firstThird)).toBeGreaterThan(1);
    expect(zoomAfter(0.1, steps)).toBeCloseTo(4, 3);
  });

  it('starts each leg from where the camera limits stopped the last one', () => {
    const steps = zoomPath({ from: 0.4, legs: [{ to: 0.01, ms: 300 }, { to: 1, ms: 300 }], anchor: { x: 0, y: 0 }, clamp: { min: 0.05, max: 4 } });
    const second = steps.slice(steps.length / 2);

    expect(zoomAfter(0.05, second)).toBeCloseTo(1, 3);
  });

  it('is the same script on every run', () => {
    const make = () => zoomPath({ from: 0.3, legs: [{ to: 0.6, ms: 400 }, { to: 0.3, ms: 400 }], anchor: { x: 10, y: 20 } });

    expect(make()).toEqual(make());
  });
});

describe('panPath', () => {
  it('covers the asked distance with a momentum tail that decays to nothing', () => {
    const steps = panPath({ legs: [{ by: { x: 3000, y: 0 }, ms: 1500 }, { by: { x: -1000, y: 600 }, ms: 1000 }], tailMs: 600, at: { x: 700, y: 450 } });
    const total = moved(steps);

    expect(total.x).toBeGreaterThan(1500);
    expect(total.y).toBeGreaterThan(600);
    expect(Math.abs(steps.at(-1)!.dx) + Math.abs(steps.at(-1)!.dy)).toBeLessThan(1);
  });
});

describe('dragPan', () => {
  it('drags the pointer along the same curve, pressed for the whole path', () => {
    const drag = dragPan({ legs: [{ by: { x: 800, y: 0 }, ms: 800 }, { by: { x: -800, y: 0 }, ms: 800 }], at: { x: 700, y: 450 } });

    expect(drag[0].at).toBe(0);
    expect(drag.at(-1)!.x).toBeCloseTo(700, 0);
    expect(Math.max(...drag.map((p) => p.x))).toBeCloseTo(1500, 0);
  });
});
