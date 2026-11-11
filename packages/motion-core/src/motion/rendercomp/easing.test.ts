import { describe, expect, it } from 'vitest';
import { snapcnKit } from '../snapcn/kit';

const S = snapcnKit();
const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 10);

describe('remotion interpolate and Easing as the templates use them', () => {
  it('maps a multi-segment range and clamps either side', () => {
    expect(S.interpolate(5, [0, 10], [0, 100])).toBe(50);
    expect(S.interpolate(15, [0, 10, 20], [0, 100, 0])).toBe(50);
    expect(S.interpolate(-4, [0, 10], [3, 9], { extrapolateLeft: 'clamp' })).toBe(3);
    expect(S.interpolate(40, [0, 10], [3, 9], { extrapolateRight: 'clamp' })).toBe(9);
  });

  it('extends past the range by default', () => {
    expect(S.interpolate(20, [0, 10], [0, 100])).toBe(200);
  });

  it('matches the closed forms of the Easing curves', () => {
    near(S.Easing.quad(0.5), 0.25);
    near(S.Easing.cubic(0.5), 0.125);
    near(S.Easing.out(S.Easing.cubic)(0.5), 0.875);
    near(S.Easing.inOut(S.Easing.quad)(0.25), 0.125);
    near(S.Easing.inOut(S.Easing.quad)(0.75), 0.875);
    near(S.Easing.out(S.Easing.quad)(0.5), 0.75);
    near(S.Easing.sin(1), 1);
    near(S.Easing.circle(0.5), 1 - Math.sqrt(0.75));
    near(S.Easing.exp(0.5), Math.pow(2, 10 * (0.5 - 1)));
  });

  it('passes through the ends of a bezier and is linear for the identity curve', () => {
    const curve = S.Easing.bezier(0.25, 1, 0.5, 1);
    near(curve(0), 0);
    near(curve(1), 1);
    near(S.Easing.bezier(0, 0, 1, 1)(0.3), 0.3);
    near(S.Easing.bezier(0.42, 0, 0.58, 1)(0.5), 0.5);
  });

  it('runs a back ease with the overshoot constant 1.70158', () => {
    near(S.Easing.back()(0.5), 0.5 * 0.5 * (2.70158 * 0.5 - 1.70158));
  });
});
