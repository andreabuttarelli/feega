import { describe, expect, it } from 'vitest';
import { customSize } from './custom-size';
import { MAX_SHORT_SIDE, MAX_SIDE, MotionFormat, formatOf, newMotionDoc, motionDocSchema } from './doc';
import { setCanvas } from './timeline';

const ratio = (s: { width: number; height: number }) => s.width / s.height;

describe('customSize', () => {
  it('keeps the node aspect', () => {
    const size = customSize({ width: 500, height: 300 });

    expect(Math.abs(ratio(size) - 500 / 300)).toBeLessThan(0.01);
  });

  it('fills the long side up to the max side', () => {
    expect(customSize({ width: 600, height: 200 }).width).toBe(MAX_SIDE);
  });

  it('caps the short side at 1080p', () => {
    expect(customSize({ width: 400, height: 400 })).toEqual({ width: MAX_SHORT_SIDE, height: MAX_SHORT_SIDE });
  });

  it('gives even sides the doc accepts', () => {
    const size = customSize({ width: 333, height: 211 });

    expect([size.width % 2, size.height % 2]).toEqual([0, 0]);
    expect(motionDocSchema.safeParse({ ...newMotionDoc(MotionFormat.Landscape), ...size }).success).toBe(true);
  });

  it('never goes under the doc minimum on a sliver', () => {
    expect(customSize({ width: 2000, height: 4 }).height).toBeGreaterThanOrEqual(16);
  });
});

describe('custom format', () => {
  it('picking custom keeps the current size', () => {
    const result = setCanvas(newMotionDoc(MotionFormat.Vertical), { format: MotionFormat.Custom });

    expect(result.ok && [result.doc.width, result.doc.height, formatOf(result.doc)]).toEqual([1080, 1920, MotionFormat.Custom]);
  });

  it('a custom size sets width and height and stays custom', () => {
    const result = setCanvas(newMotionDoc(MotionFormat.Landscape), { size: { width: 1200, height: 900 } });

    expect(result.ok && [result.doc.width, result.doc.height, formatOf(result.doc)]).toEqual([1200, 900, MotionFormat.Custom]);
  });

  it('a preset leaves custom', () => {
    const custom = setCanvas(newMotionDoc(MotionFormat.Landscape), { format: MotionFormat.Custom });
    const back = custom.ok ? setCanvas(custom.doc, { format: MotionFormat.Square }) : custom;

    expect(back.ok && formatOf(back.doc)).toBe(MotionFormat.Square);
  });

  it('refuses a size above 1080p', () => {
    expect(setCanvas(newMotionDoc(MotionFormat.Landscape), { size: { width: 1920, height: 1920 } }).ok).toBe(false);
  });
});
