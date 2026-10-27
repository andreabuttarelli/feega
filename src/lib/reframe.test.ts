import { describe, expect, it } from 'vitest';
import { aspectSchema, cropRect, ratioOf, reframeExtend } from './reframe';

describe('ratioOf', () => {
  it('reads a preset or a custom w:h', () => {
    expect(ratioOf('9:16')).toBeCloseTo(0.5625);
    expect(ratioOf('4:5')).toBeCloseTo(0.8);
    expect(ratioOf('21:9')).toBeCloseTo(21 / 9);
  });
});

describe('aspectSchema', () => {
  it('accepts w:h and refuses anything else', () => {
    expect(aspectSchema.safeParse('1:1').success).toBe(true);
    expect(aspectSchema.safeParse('0:5').success).toBe(false);
    expect(aspectSchema.safeParse('wide').success).toBe(false);
  });
});

describe('reframeExtend', () => {
  it('pads top and bottom evenly when the target is taller', () => {
    expect(reframeExtend({ width: 100, height: 100 }, 0.5)).toEqual({ top: 0.5, bottom: 0.5 });
  });

  it('pads left and right evenly when the target is wider', () => {
    expect(reframeExtend({ width: 100, height: 100 }, 2)).toEqual({ left: 0.5, right: 0.5 });
  });

  it('is empty when the picture already has the aspect', () => {
    expect(reframeExtend({ width: 160, height: 90 }, 16 / 9)).toBeNull();
  });
});

describe('cropRect', () => {
  const size = { width: 1920, height: 1080 };

  it('cuts a centred vertical slice for 9:16', () => {
    expect(cropRect(size, 9 / 16)).toEqual({ x: 656, y: 0, width: 608, height: 1080 });
  });

  it('follows the focus point and stays inside the picture', () => {
    expect(cropRect(size, 9 / 16, { x: 0, y: 0.5 }).x).toBe(0);
    expect(cropRect(size, 9 / 16, { x: 1, y: 0.5 }).x).toBe(1920 - 608);
  });

  it('cuts top and bottom when the target is wider', () => {
    expect(cropRect({ width: 1000, height: 1000 }, 2)).toEqual({ x: 0, y: 250, width: 1000, height: 500 });
  });

  it('gives even sizes so the encoder accepts them', () => {
    const rect = cropRect({ width: 1001, height: 999 }, 9 / 16);
    expect(rect.width % 2).toBe(0);
    expect(rect.height % 2).toBe(0);
  });
});
