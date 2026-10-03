import { describe, expect, it } from 'vitest';
import gsap from 'gsap';
import { Ease } from './design';
import { ANIMATABLE, TRANSFORM, easeName, isAnimatable, keyframesProblem, mixColor, sampleTrack, type Keyframe } from './keyframes';

const track: Keyframe[] = [
  { frame: 0, value: 0, ease: Ease.Linear },
  { frame: 30, value: 90, ease: Ease.Standard },
  { frame: 60, value: 180, ease: [0.25, 0.1, 0.25, 1] }
];

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
    expect(half).toBeCloseTo(90 + 90 * (1 - 0.5 ** 4), 6);
  });

  it('every named ease matches the GSAP ease the generator emits', () => {
    for (const ease of Object.values(Ease)) {
      const gsapEase = gsap.parseEase(easeName(ease));
      for (let i = 0; i <= 20; i++) {
        const p = i / 20;
        expect(sampleTrack([{ frame: 0, value: 0, ease }, { frame: 20, value: 1, ease: Ease.Linear }], i)).toBeCloseTo(gsapEase(p), 9);
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

  it('anchors and audio are not animated', () => {
    expect(isAnimatable('Title', 'anchorX')).toBe(false);
    expect(ANIMATABLE.Audio).toEqual([]);
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
    expect(keyframesProblem('Title', { orbit: [{ frame: 0, value: 1, ease: Ease.Linear }] })).toMatch(/orbit/);
    expect(keyframesProblem('Title', { rotateX: [{ frame: 0, value: 9999, ease: Ease.Linear }] })).toMatch(/rotateX/);
    expect(keyframesProblem('Title', { color: [{ frame: 0, value: 3, ease: Ease.Linear }] })).toMatch(/colour/);
    expect(keyframesProblem('Title', { color: [{ frame: 0, value: 'brand.accent', ease: Ease.Linear }], rotateZ: [{ frame: 3, value: 45, ease: Ease.Linear }] })).toBeNull();
  });
});
