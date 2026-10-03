import { describe, expect, it } from 'vitest';
import { Ease, TransitionKind, clipLook, ease, transitionLook } from './design';

describe('motion design system', () => {
  it('every easing starts at 0 and lands on 1', () => {
    for (const kind of Object.values(Ease)) {
      expect(ease(kind, 0)).toBeCloseTo(0, 3);
      expect(ease(kind, 1)).toBeCloseTo(1, 3);
    }
  });

  it('overshoot passes beyond 1 before settling', () => {
    expect(Math.max(...[0.6, 0.7, 0.8].map((t) => ease(Ease.Overshoot, t)))).toBeGreaterThan(1);
  });

  it('a hidden fade is transparent, a shown one opaque', () => {
    expect(transitionLook(TransitionKind.Fade, 1).opacity).toBe(0);
    expect(transitionLook(TransitionKind.Fade, 0).opacity).toBe(1);
  });

  it('a clip is fully visible between its transitions', () => {
    const edge = { kind: TransitionKind.SlideUp, durationInFrames: 10 };

    expect(clipLook(50, 100, edge, edge)).toEqual({ opacity: 1, transform: '', clipPath: '', filter: '' });
    expect(clipLook(0, 100, edge, edge).opacity).toBe(0);
    expect(clipLook(99, 100, edge, edge).opacity).toBeLessThan(0.2);
  });
});
