import { describe, expect, it } from 'vitest';
import type { Glyphs, ChromeTile } from './chrome';
import { nodeHitRects } from './node-hit';
import { SpatialIndex } from './spatial-index';
import { LABEL_HIDE_FRAME_PX, labelScreenPx, labelZoomStep } from './label-size';

const glyphs: Glyphs = (text, size) => ({ contours: [], width: text.length * size * 0.5, height: size });

const frame = (over: Partial<ChromeTile> = {}): ChromeTile => ({ id: 'f', x: 1000, y: 1000, width: 4000, height: 3000, inputs: [], outputs: [], label: 'Hero', icon: null, ...over });

const ZOOMS = [0.1, 0.25, 0.5, 1, 2];

const indexAt = (zoom: number, over: Partial<ChromeTile> = {}) => {
  const tile = frame({ zoom: labelZoomStep(zoom), ...over });
  return { tile, index: new SpatialIndex(nodeHitRects(tile, glyphs)) };
};

describe('nodeHitRects', () => {
  it.each(ZOOMS)('the label box is on screen size at %s zoom', (zoom) => {
    const step = labelZoomStep(zoom);
    const [, label] = nodeHitRects(frame({ zoom: step }), glyphs);
    const heightOnScreen = label.h * step;
    expect(heightOnScreen).toBeCloseTo(labelScreenPx(step) * 1.3, 5);
    expect(label.w * step).toBeCloseTo(4 * labelScreenPx(step) * 0.5, 5);
  });

  it.each(ZOOMS)('a point inside the label selects the frame at %s zoom', (zoom) => {
    const { tile, index } = indexAt(zoom);
    const [, label] = nodeHitRects(tile, glyphs);
    expect(index.topAt({ x: label.x + label.w / 2, y: label.y + label.h / 2 })).toBe('f');
    expect(index.topAt({ x: label.x + 0.01, y: label.y + 0.01 })).toBe('f');
  });

  it.each(ZOOMS)('a point just outside the label does not at %s zoom', (zoom) => {
    const { tile, index } = indexAt(zoom);
    const [, label] = nodeHitRects(tile, glyphs);
    const pixel = 1 / labelZoomStep(zoom);
    expect(index.topAt({ x: label.x + label.w + pixel, y: label.y + label.h / 2 })).toBeNull();
    expect(index.topAt({ x: label.x + label.w / 2, y: label.y - pixel })).toBeNull();
    expect(index.topAt({ x: label.x - pixel, y: label.y + label.h / 2 })).toBeNull();
  });

  it('keeps the old fixed band out of the hit area at 200 percent', () => {
    const { tile, index } = indexAt(2);
    expect(index.topAt({ x: tile.x + tile.width - 1, y: tile.y - 20 })).toBeNull();
  });

  it('does not hit a label the frame is too narrow to show', () => {
    const zoom = 0.1;
    const narrow = (LABEL_HIDE_FRAME_PX - 1) / zoom;
    const { tile, index } = indexAt(zoom, { width: narrow });
    expect(nodeHitRects(tile, glyphs)).toHaveLength(1);
    expect(index.topAt({ x: tile.x + 1, y: tile.y - 5 })).toBeNull();
  });

  it('has no label box without a label', () => {
    expect(nodeHitRects(frame({ label: null }), glyphs)).toHaveLength(1);
  });

  it('adds the tag dot as its own box', () => {
    const rects = nodeHitRects(frame({ zoom: 1, tag: '#ff0000' }), glyphs);
    expect(rects).toHaveLength(3);
    expect(rects[2].x + rects[2].w).toBeCloseTo(5000, 5);
  });

  it('cuts the label to the frame width', () => {
    const [, label] = nodeHitRects(frame({ zoom: 1, width: 60, label: 'A very long frame name' }), glyphs);
    expect(label.x + label.w).toBeLessThanOrEqual(1060);
  });
});
