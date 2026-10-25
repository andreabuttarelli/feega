import { describe, expect, it } from 'vitest';
import { flatten, type Pt } from '@feega/motion-core/motion/shape/geometry';
import { smoothStroke, straightStroke } from './pencil';

const wave = (n: number): Pt[] => Array.from({ length: n }, (_, i) => [i * 2, Math.sin(i / 8) * 40] as Pt);
const nearest = (pts: Pt[], p: Pt) => Math.min(...pts.map((q) => Math.hypot(q[0] - p[0], q[1] - p[1])));

describe('pencil stroke', () => {
  it('turns hundreds of pointer samples into a few smooth vertices', () => {
    const samples = wave(300);
    const [contour] = smoothStroke(samples);
    expect(contour.closed).toBe(false);
    expect(contour.vertices.length).toBeLessThan(80);
    expect(contour.vertices.length).toBeGreaterThan(3);
    expect(contour.vertices[0].p).toEqual(samples[0]);
    expect(contour.vertices.at(-1)!.p).toEqual(samples.at(-1));
  });

  it('stays within a couple of pixels of what was drawn', () => {
    const samples = wave(300);
    const drawn = flatten(smoothStroke(samples)[0]);
    expect(Math.max(...samples.map((s) => nearest(drawn, s)))).toBeLessThan(3);
  });

  it('a looser tolerance keeps fewer vertices', () => {
    const samples = wave(300);
    expect(smoothStroke(samples, 8)[0].vertices.length).toBeLessThan(smoothStroke(samples, 1)[0].vertices.length);
  });

  it('gives interior vertices handles so the curve is smooth', () => {
    const [contour] = smoothStroke(wave(300));
    const inner = contour.vertices[1];
    expect(inner.in).not.toEqual(inner.p);
    expect(inner.out).not.toEqual(inner.p);
  });

  it('ignores a lone click and keeps two samples as a straight line', () => {
    expect(smoothStroke([[1, 1]])).toEqual([]);
    const [line] = smoothStroke([[0, 0], [10, 0]]);
    expect(line.vertices.map((v) => v.p)).toEqual([[0, 0], [10, 0]]);
  });

  it('draws a straight segment between two points', () => {
    const [line] = straightStroke([0, 0], [30, 40]);
    expect(line.vertices.map((v) => v.p)).toEqual([[0, 0], [30, 40]]);
  });
});
