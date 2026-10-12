import { describe, expect, it } from 'vitest';
import { GTW_MODEL } from './model';

type Tile = { row: number; slot: number; item: number; x: number; y: number; z: number; a: number; b: number; facing: number; shown: boolean };
type Frame = { tilt: number; tiles: Tile[] };
type Layout = { tileW: number; tileH: number; rows: { slots: number }[] };
type Model = {
  wallLayout: (p: object, width: number, height: number) => Layout;
  wallFrame: (layout: Layout, p: object, t: number, length: number) => Frame;
  panAt: (p: object, t: number, length: number) => number;
};

const model = new Function(`${GTW_MODEL}; return { wallLayout, wallFrame, panAt };`)() as Model;

const PARAMS = { tileSize: 0.34, tileAspect: 1.42, gap: 0.06, curve: 0.9, moves: 3, step: 2, tilt: 4, lift: 1 };
const SIZES = { landscape: [1920, 1080], vertical: [1080, 1920], square: [1080, 1080] } as const;
const LENGTH = 12;
const FPS = 60;
const times = () => Array.from({ length: LENGTH * FPS + 1 }, (_, i) => i / FPS);
const frameOf = (t: number, [w, h]: readonly number[] = SIZES.landscape, p: object = PARAMS) => model.wallFrame(model.wallLayout(p, w, h), p, t, LENGTH);
const shownKey = (f: Frame) => f.tiles.filter((t) => t.shown).map((t) => `${t.row}:${t.item}:${t.x.toFixed(3)}:${t.y.toFixed(3)}:${t.z.toFixed(3)}`).sort();

describe('the glass tiles wall model', () => {
  it.each(Object.entries(SIZES))('ends the %s loop on the frame it started from', (_, size) => {
    expect(shownKey(frameOf(LENGTH, size))).toEqual(shownKey(frameOf(0, size)));
    expect(frameOf(LENGTH, size).tilt).toBeCloseTo(frameOf(0, size).tilt, 9);
  });

  it('pans forward only, holding between moves, never past the target', () => {
    const pans = times().map((t) => model.panAt(PARAMS, t, LENGTH));
    pans.slice(1).forEach((v, i) => expect(v).toBeGreaterThanOrEqual(pans[i] - 1e-12));
    expect(pans[0]).toBe(0);
    expect(pans[pans.length - 1]).toBeCloseTo(1, 9);
    expect(pans.filter((v, i) => i > 0 && v === pans[i - 1]).length).toBeGreaterThan(LENGTH * FPS * 0.15);
  });

  it.each(Object.entries(SIZES))('moves every visible %s tile smoothly from frame to frame', (_, size) => {
    const layout = model.wallLayout(PARAMS, size[0], size[1]);
    let previous = model.wallFrame(layout, PARAMS, 0, LENGTH);
    for (const t of times().slice(1)) {
      const next = model.wallFrame(layout, PARAMS, t, LENGTH);
      next.tiles.forEach((tile, i) => {
        if (tile.shown && previous.tiles[i].shown) {
          expect(Math.abs(tile.x - previous.tiles[i].x), `tile ${i} at ${t}`).toBeLessThan(layout.tileW * 0.25);
        }
      });
      previous = next;
    }
  });

  it.each(Object.entries(SIZES))('keeps every %s tile on the same picture for the whole loop', (_, size) => {
    const items = frameOf(0, size).tiles.map((t) => t.item);
    times().forEach((t) => expect(frameOf(t, size).tiles.map((x) => x.item)).toEqual(items));
  });

  it.each(Object.entries(SIZES))('covers the %s frame centre and corners at all times', (_, size) => {
    const [w, h] = size;
    for (const t of [0, 1.7, 4, 6.3, 9, 11.9]) {
      const shown = frameOf(t, size).tiles.filter((x) => x.shown);
      expect(shown.some((x) => Math.abs(x.x) < w * 0.3 && Math.abs(x.y) < h * 0.3)).toBe(true);
      expect(shown.some((x) => x.x < -w * 0.3 && x.y < -h * 0.25)).toBe(true);
      expect(shown.some((x) => x.x > w * 0.3 && x.y > h * 0.25)).toBe(true);
    }
  });

  it('bends the wall away from the camera toward its edges', () => {
    const shown = frameOf(0).tiles.filter((x) => x.shown);
    const centre = shown.reduce((a, b) => (Math.hypot(a.x, a.y) < Math.hypot(b.x, b.y) ? a : b));
    const edge = shown.reduce((a, b) => (Math.abs(a.x) > Math.abs(b.x) ? a : b));
    expect(edge.z).toBeLessThan(centre.z);
    expect(edge.facing).toBeLessThan(centre.facing);
  });

  it('hides tiles turned away from the camera', () => {
    frameOf(3).tiles.filter((x) => x.shown).forEach((x) => expect(x.facing).toBeGreaterThan(0));
  });
});
