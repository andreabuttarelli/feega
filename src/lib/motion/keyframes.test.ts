import { describe, expect, it } from 'vitest';
import { motionEngine } from './engine/engine';
import { Ease } from './design';
import { ANIMATABLE, EASE_BEZIER, Interp, TRANSFORM, easeName, isAnimatable, keyframesProblem, mixColor, sampleTrack, type Keyframe } from './keyframes';

const track: Keyframe[] = [
  { frame: 0, value: 0, ease: Ease.Linear },
  { frame: 30, value: 90, ease: Ease.Standard },
  { frame: 60, value: 180, ease: [0.25, 0.1, 0.25, 1] }
];

const standard = motionEngine({} as Window & Record<string, unknown>).parseEase('feega.inOut');

describe('keyframe interpolation', () => {
  it('holds the first value before and the last value after', () => {
    expect(sampleTrack(track, -5)).toBe(0);
    expect(sampleTrack(track, 200)).toBe(180);
  });

  it('a single keyframe is a constant', () => {
    expect(sampleTrack([{ frame: 10, value: 4, ease: Ease.Linear }], 0)).toBe(4);
  });

  it('a linear segment is a straight line', () => {
    expect(sampleTrack(track, 15)).toBe(45);
  });

  it('the ease of a segment is the ease of the keyframe it leaves', () => {
    const half = sampleTrack(track, 45);
    expect(half).toBeCloseTo(90 + 90 * standard(0.5), 6);
  });

  it('every named ease matches the engine ease the generator emits', () => {
    const engine = motionEngine({ document: undefined } as unknown as Window & Record<string, unknown>);
    for (const ease of Object.values(Ease)) {
      const engineEase = engine.parseEase(easeName(ease));
      for (let i = 0; i <= 20; i++) {
        const p = i / 20;
        expect(sampleTrack([{ frame: 0, value: 0, ease }, { frame: 20, value: 1, ease: Ease.Linear }], i)).toBeCloseTo(engineEase(p), 9);
      }
    }
  });

  it('a custom cubic-bezier passes through its ends and is monotonic for a monotonic curve', () => {
    const curve = (p: number) => sampleTrack([{ frame: 0, value: 0, ease: [0.42, 0, 0.58, 1] }, { frame: 1, value: 1, ease: Ease.Linear }], p);
    expect(curve(0)).toBe(0);
    expect(curve(1)).toBe(1);
    expect(curve(0.5)).toBeCloseTo(0.5, 6);
    expect(curve(0.25)).toBeLessThan(curve(0.3));
  });

  it('the sampler survives being serialised into the composition', () => {
    const revived = new Function(`return (${sampleTrack.toString()})`)() as typeof sampleTrack;
    for (const f of [0, 7, 29, 31, 44, 59, 61]) {
      expect(revived(track, f)).toBe(sampleTrack(track, f));
    }
  });
});

describe('colour keyframes', () => {
  it('mix in rgb channel by channel', () => {
    expect(mixColor('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixColor('#ff0000', '#0000ff', 0)).toBe('#ff0000');
  });
});

describe('what can be animated', () => {
  it('every visual component animates its transform', () => {
    expect(isAnimatable('Title', 'rotateY')).toBe(true);
    expect(isAnimatable('Image', 'blur')).toBe(true);
  });

  it('anchors are not animated; audio animates only its volume and pan', () => {
    expect(isAnimatable('Title', 'anchorX')).toBe(false);
    expect(ANIMATABLE.Audio.map((p) => p.key)).toEqual(['volume', 'pan']);
  });

  it('colour props animate on the components that have them', () => {
    expect(isAnimatable('Caption', 'background')).toBe(true);
    expect(isAnimatable('Image', 'color')).toBe(false);
  });

  it('a 3D model animates its object and its camera', () => {
    for (const key of ['objectRotateX', 'objectRotateY', 'objectRotateZ', 'orbit', 'dolly', 'fov']) {
      expect(isAnimatable('Model3D', key)).toBe(true);
    }
    expect(isAnimatable('Title', 'orbit')).toBe(false);
  });

  it('every transform key has a range around its rest value', () => {
    for (const spec of Object.values(TRANSFORM)) {
      expect(spec.fallback).toBeGreaterThanOrEqual(spec.min);
      expect(spec.fallback).toBeLessThanOrEqual(spec.max);
    }
  });

  it('refuses a keyframe on a prop the component cannot animate, or out of range', () => {
    expect(keyframesProblem({ component: 'Title', mask: null, keyframes: { orbit: [{ frame: 0, value: 1, ease: Ease.Linear }] } })).toMatch(/orbit/);
    expect(keyframesProblem({ component: 'Title', mask: null, keyframes: { rotateX: [{ frame: 0, value: 9999, ease: Ease.Linear }] } })).toMatch(/rotateX/);
    expect(keyframesProblem({ component: 'Title', mask: null, keyframes: { color: [{ frame: 0, value: 3, ease: Ease.Linear }] } })).toMatch(/colour/);
    expect(keyframesProblem({ component: 'Title', mask: null, keyframes: { color: [{ frame: 0, value: 'brand.accent', ease: Ease.Linear }], rotateZ: [{ frame: 3, value: 45, ease: Ease.Linear }] } })).toBeNull();
  });
});

const key = (frame: number, value: number, extra: Partial<Keyframe> = {}): Keyframe => ({ frame, value, ease: Ease.Standard, ...extra });
const slope = (t: Keyframe[], f: number, side: number) => (sampleTrack(t, f + side * 1e-4) - sampleTrack(t, f)) / (side * 1e-4);

describe('interpolation kinds per keyframe', () => {
  it('without in/out a keyframe keeps its bezier ease, as before', () => {
    expect(sampleTrack([key(0, 0), key(30, 90)], 15)).toBeCloseTo(90 * standard(0.5), 9);
  });

  it('hold out keeps the value until the next keyframe, then jumps', () => {
    const t = [key(0, 0, { out: Interp.Hold }), key(10, 100)];
    expect(sampleTrack(t, 9.99)).toBe(0);
    expect(sampleTrack(t, 10)).toBe(100);
  });

  it('hold in on the next keyframe holds the segment too', () => {
    expect(sampleTrack([key(0, 5), key(10, 100, { in: Interp.Hold })], 7)).toBe(5);
  });

  it('linear out and linear in ignore the ease and draw a straight line', () => {
    const t = [key(0, 0, { out: Interp.Linear }), key(30, 90, { in: Interp.Linear })];
    expect(sampleTrack(t, 10)).toBeCloseTo(30, 9);
  });

  it('auto-bezier is smooth through a middle keyframe', () => {
    const t = [key(0, 0, { out: Interp.Auto }), key(20, 50, { in: Interp.Auto, out: Interp.Auto }), key(30, 100, { in: Interp.Auto })];
    expect(slope(t, 20, -1)).toBeCloseTo(slope(t, 20, 1), 2);
    expect(slope(t, 20, 1)).toBeCloseTo(100 / 30, 2);
  });

  it('auto-bezier flattens at a peak instead of overshooting it', () => {
    const t = [key(0, 0, { out: Interp.Auto }), key(10, 100, { in: Interp.Auto, out: Interp.Auto }), key(30, 0, { in: Interp.Auto })];
    for (let f = 0; f <= 30; f += 0.5) {
      expect(sampleTrack(t, f)).toBeLessThanOrEqual(100 + 1e-9);
    }
    expect(slope(t, 10, 1)).toBeCloseTo(0, 2);
  });

  it('continuous keeps the through-velocity even at a peak', () => {
    const t = [key(0, 0, { out: Interp.Continuous }), key(10, 100, { in: Interp.Continuous, out: Interp.Continuous }), key(20, 50, { in: Interp.Continuous })];
    expect(slope(t, 10, -1)).toBeCloseTo(slope(t, 10, 1), 2);
    expect(slope(t, 10, 1)).toBeCloseTo((50 - 0) / 20, 2);
  });

  it('two equal values stay flat whatever the kind', () => {
    const t = [key(0, 3, { out: Interp.Continuous }), key(10, 3, { in: Interp.Continuous })];
    expect(sampleTrack(t, 4)).toBe(3);
  });

  it('a bezier side meets an auto side with the slope of its own handle', () => {
    const t = [key(0, 0, { ease: [0.5, 0, 0.5, 1] }), key(10, 100, { in: Interp.Linear })];
    expect(slope(t, 0, 1)).toBeCloseTo(0, 1);
    expect(slope(t, 10, -1)).toBeCloseTo(10, 1);
  });

  it('a roving keyframe is retimed so the speed is even between its fixed neighbours', () => {
    const t = [key(0, 0, { ease: Ease.Linear }), key(10, 50, { ease: Ease.Linear, roving: true }), key(40, 100, { ease: Ease.Linear })];
    expect(sampleTrack(t, 20)).toBeCloseTo(50, 9);
    expect(sampleTrack(t, 10)).toBeCloseTo(25, 9);
  });

  it('the first and last keyframes never rove', () => {
    const t = [key(0, 0, { ease: Ease.Linear, roving: true }), key(10, 100, { ease: Ease.Linear, roving: true })];
    expect(sampleTrack(t, 5)).toBeCloseTo(50, 9);
  });

  it('every kind samples the same in the serialised sampler', () => {
    const revived = new Function(`return (${sampleTrack.toString()})`)() as typeof sampleTrack;
    const t = [key(0, 0, { out: Interp.Auto }), key(7, 40, { in: Interp.Continuous, out: Interp.Hold }), key(12, 60, { roving: true }), key(30, 10, { in: Interp.Linear })];
    for (let f = 0; f <= 30; f += 0.25) {
      expect(revived(t, f)).toBe(sampleTrack(t, f));
    }
  });

  it('roving is only for spatial props', () => {
    expect(keyframesProblem({ component: 'Title', mask: null, keyframes: { opacity: [key(0, 0), key(5, 1, { roving: true }), key(9, 0)] } })).toMatch(/roving/);
    expect(keyframesProblem({ component: 'Title', mask: null, keyframes: { x: [key(0, 0), key(5, 0.2, { roving: true }), key(9, 0.4)] } })).toBeNull();
  });
});

describe('named ease handles', () => {
  it('the sampler meets a non-bezier side with the same handle the graph editor shows', () => {
    for (const ease of Object.values(Ease)) {
      const [x1, y1] = EASE_BEZIER[ease];
      const t = [key(0, 0, { ease }), key(10, 100, { in: Interp.Linear })];
      expect(slope(t, 0, 1)).toBeCloseTo((y1 / x1) * 10, 1);
    }
  });
});

describe('the house curves on keyframes', () => {
  const HOUSE: [Ease, string][] = [
    [Ease.Standard, 'feega.inOut'],
    [Ease.Enter, 'feega.out'],
    [Ease.Exit, 'feega.in']
  ];

  it('standard, enter and exit render on feega.inOut, feega.out and feega.in', () => {
    for (const [ease, name] of HOUSE) {
      expect(easeName(ease)).toBe(name);
    }
  });
});
