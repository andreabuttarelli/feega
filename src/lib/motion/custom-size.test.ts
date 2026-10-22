import { describe, expect, it } from 'vitest';
import { customSize, fitElementToNode } from './custom-size';
import { Horizontal, Vertical } from './constraints/model';
import { MAX_SHORT_SIDE, MAX_SIDE, MotionFormat, formatOf, newMotionDoc, motionDocSchema, type MotionDoc } from './doc';
import { setCanvas } from './timeline';

const ratio = (s: { width: number; height: number }) => s.width / s.height;

describe('customSize', () => {
  it('keeps the node pixels when a video fits', () => {
    expect(customSize({ width: 500, height: 300 })).toEqual({ width: 500, height: 300 });
  });

  it('keeps the aspect when a video side is over the limit', () => {
    const size = customSize({ width: 4000, height: 1000 });

    expect(size.width).toBe(MAX_SIDE);
    expect(Math.abs(ratio(size) - 4)).toBeLessThan(0.01);
  });

  it('caps the short side at 1080p', () => {
    expect(customSize({ width: 3000, height: 3000 })).toEqual({ width: MAX_SHORT_SIDE, height: MAX_SHORT_SIDE });
  });

  it('gives even sides the doc accepts', () => {
    const size = customSize({ width: 333, height: 211 });

    expect([size.width % 2, size.height % 2]).toEqual([0, 0]);
    expect(motionDocSchema.safeParse({ ...newMotionDoc(MotionFormat.Landscape), ...size }).success).toBe(true);
  });

  it('never goes under the doc minimum on a sliver', () => {
    expect(customSize({ width: 2000, height: 4 }).height).toBeGreaterThanOrEqual(16);
  });

  it('gives a still the exact pixels, any ratio', () => {
    expect(customSize({ width: 333, height: 2111 }, { still: { frame: 0 } })).toEqual({ width: 333, height: 2111 });
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

describe('fitElementToNode', () => {
  it('stretches a pinned shape with its element node, so the shape keeps filling it', () => {
    const base = newMotionDoc(MotionFormat.Landscape);
    const shape = { id: 's', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1 }, transform: {}, keyframes: {}, constraints: { horizontal: Horizontal.Left, vertical: Vertical.Top } };
    const doc = { ...base, width: 200, height: 100, tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [shape] }] } as unknown as MotionDoc;

    const sized = fitElementToNode(doc, { width: 300, height: 100 });

    expect(sized.ok && sized.doc.tracks[0].clips[0].props).toMatchObject({ x: 0.5, width: 1 });
    expect(sized.ok && sized.doc.tracks[0].clips[0].constraints).toEqual(shape.constraints);
  });
});
