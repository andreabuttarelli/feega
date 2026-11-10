import { describe, expect, it } from 'vitest';
import { snapcnKit } from './kit';

const S = snapcnKit();

describe('snapcn kit', () => {
  it('interpolates with clamp and extend like a frame tween', () => {
    expect(S.interpolate(5, [0, 10], [0, 100])).toBe(50);
    expect(S.interpolate(20, [0, 10], [0, 100])).toBe(200);
    expect(S.interpolate(20, [0, 10], [0, 100], { extrapolateRight: 'clamp' })).toBe(100);
    expect(S.interpolate(-5, [0, 10], [0, 100], { extrapolateLeft: 'clamp' })).toBe(0);
    expect(S.interpolate(15, [0, 10, 20], [0, 100, 0])).toBe(50);
  });

  it('settles a spring at its target and overshoots when underdamped', () => {
    const at = (frame: number) => S.spring({ frame, fps: 30, config: { damping: 10, stiffness: 100, mass: 1 } });
    expect(at(0)).toBe(0);
    expect(Math.max(...Array.from({ length: 60 }, (_, f) => at(f)))).toBeGreaterThan(1);
    expect(at(300)).toBeCloseTo(1, 4);
  });

  it('stretches a spring to a given duration', () => {
    const end = S.spring({ frame: 20, fps: 30, durationInFrames: 20, config: { damping: 200 } });
    expect(end).toBeCloseTo(1, 2);
    expect(S.spring({ frame: 25, fps: 30, durationInFrames: 20, to: 5 })).toBe(5);
  });

  it('eases a cubic bezier through its endpoints', () => {
    const ease = S.Easing.bezier(0.22, 1, 0.36, 1);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeGreaterThan(0.8);
  });

  it('draws the same pseudo random number for the same seed', () => {
    expect(S.random('a')).toBe(S.random('a'));
    expect(S.random(1)).not.toBe(S.random(2));
  });

  it('writes react style objects as css with px on lengths only', () => {
    expect(S.css({ fontSize: 72, opacity: 0.5, lineHeight: 1.1, WebkitTextStroke: '1px red', top: 0 })).toBe('font-size:72px;opacity:0.5;line-height:1.1;-webkit-text-stroke:1px red;top:0');
  });

  it('falls back to the theme for an unset colour or font', () => {
    expect(S.pick('transparent', '#141414')).toBe('#141414');
    expect(S.pick("'DM Sans', system-ui, sans-serif", 'Inter')).toBe('Inter');
    expect(S.pick('#ff0000', '#141414')).toBe('#ff0000');
  });
});
