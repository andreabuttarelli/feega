import { describe, expect, it } from 'vitest';
import { EFFECTS, EffectKind, defaultValues, type SvgNode } from '@feega/motion-core/motion/effects/registry';

const FRAME = { width: 200, height: 100, frame: 0, fps: 30 };
const blur = (extra: Record<string, number>) => EFFECTS[EffectKind.ProgressiveBlur].render({ ...defaultValues(EffectKind.ProgressiveBlur), ...extra }, FRAME, 'f', null);
const bands = (nodes: SvgNode[]) => nodes[0].children!.filter((n) => n.tag === 'feGaussianBlur');

describe('progressive blur', () => {
  it('blurs in bands that grow from the start radius to the end radius', () => {
    const steps = bands(blur({ startRadius: 0, endRadius: 40, startX: 0.5, startY: 0, endX: 0.5, endY: 1 }).nodes);
    const radii = steps.map((n) => Number(n.attrs.stdDeviation));
    expect(radii.length).toBeGreaterThan(4);
    expect(radii).toEqual([...radii].sort((a, b) => a - b));
    expect(radii[0]).toBeLessThan(radii.at(-1)!);
  });

  it('a vertical blur cuts the layer into horizontal bands covering its height', () => {
    const steps = bands(blur({ startY: 0, endY: 1, startX: 0.5, endX: 0.5 }).nodes);
    expect(steps[0].attrs).toMatchObject({ x: 0, width: 200 });
    expect(steps.reduce((sum, n) => sum + Number(n.attrs.height), 0)).toBeCloseTo(100);
  });

  it('a horizontal blur cuts it into vertical bands', () => {
    const steps = bands(blur({ startX: 1, endX: 0, startY: 0.5, endY: 0.5 }).nodes);
    expect(steps[0].attrs).toMatchObject({ y: 0, height: 100 });
    expect(Number(steps[0].attrs.stdDeviation)).toBeGreaterThan(Number(steps.at(-1)!.attrs.stdDeviation));
  });

  it('beyond the start and end the radius holds', () => {
    const steps = bands(blur({ startRadius: 10, endRadius: 10 }).nodes);
    expect(new Set(steps.map((n) => n.attrs.stdDeviation)).size).toBe(1);
  });
});
