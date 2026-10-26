import { describe, expect, it } from 'vitest';
import { networkFill, networkStroke, outlineToNetwork } from './outline';
import { parsePath, pathData, type Outline } from '../shape/geometry';
import { Winding, type VectorNetwork } from './model';

const zero = { x: 0, y: 0 };
const line = (start: number, end: number) => ({ start, end, tangentStart: zero, tangentEnd: zero });

const outline = (d: string): Outline => {
  const parsed = parsePath(d);
  if (typeof parsed === 'string') {
    throw new Error(parsed);
  }
  return parsed;
};

describe('a vector network drawn as outlines', () => {
  const square: VectorNetwork = {
    vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
    segments: [line(0, 1), line(1, 2), line(2, 3), line(3, 0)],
    regions: [{ winding: Winding.NonZero, loops: [[0, 1, 2, 3]] }]
  };

  it('fills only its regions', () => {
    expect(pathData(networkFill(square))).toBe('M0 0L1 0L1 1L0 1Z');
    expect(networkFill({ ...square, regions: [] })).toEqual([]);
  });

  it('strokes every segment, a branch included, joining where two meet', () => {
    const tee: VectorNetwork = { vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 0 }, { x: 0.5, y: 1 }], segments: [line(0, 2), line(2, 1), line(2, 3)], regions: [] };
    expect(networkStroke(tee)).toHaveLength(3);
    expect(pathData(networkStroke(square))).toBe('M0 0L1 0L1 1L0 1Z');
  });
});

describe('an SVG path as a vector network', () => {
  it('keeps a closed curved shape exactly', () => {
    const shape = outline('M0 0C0.2 0 0.4 0.1 1 0L1 1L0 1Z');
    expect(pathData(networkFill(outlineToNetwork(shape)))).toBe(pathData(shape));
  });

  it('keeps an open line open, stroked and not filled', () => {
    const open = outline('M0 0L0.5 0.5L1 0');
    const network = outlineToNetwork(open);
    expect(network.regions).toEqual([]);
    expect(pathData(networkStroke(network))).toBe(pathData(open));
  });

  it('keeps every contour, holes included', () => {
    const ring = outline('M0 0L1 0L1 1L0 1ZM0.25 0.25L0.25 0.75L0.75 0.75L0.75 0.25Z');
    expect(outlineToNetwork(ring).regions[0].loops).toHaveLength(2);
    expect(pathData(networkFill(outlineToNetwork(ring)))).toBe(pathData(ring));
  });
});
