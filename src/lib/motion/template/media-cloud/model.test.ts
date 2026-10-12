import { describe, expect, it } from 'vitest';
import { CLOUD_MODEL } from './model';

type Tile = { x: number; y: number; w: number; h: number; scale: number; depth: number; opacity: number; blur: number; z: number };
type Word = { y: number; opacity: number };
type Frame = { tiles: Tile[]; words: Word[]; clear: number };
type Box = { hw: number; hh: number };
type Model = {
  cloudLayout: (p: object, width: number, height: number) => { i: number; w: number; h: number }[];
  cloudFrame: (layout: object[], p: object, t: number, length: number, clear: Box) => Frame;
  frameBox: (width: number, height: number) => { ax: number; ay: number };
};

const model = new Function(`${CLOUD_MODEL}; return { cloudLayout, cloudFrame, frameBox };`)() as Model;

const PARAMS = { title: 'made of moments', count: 150, tileSize: 0.07, spread: 1, centreBoost: 1.2, passes: 1, drift: 0.05, blur: 0.6, titleAt: 7, clearing: 1 };
const LENGTH = 12;
const FPS = 30;
const TITLE: Box = { hw: 0.5, hh: 0.08 };
const ASPECTS = { landscape: [1920, 1080], vertical: [1080, 1920], square: [1080, 1080] } as const;

const times = () => Array.from({ length: LENGTH * FPS + 1 }, (_, i) => i / FPS);
const frameAt = (t: number, p = PARAMS, size: readonly number[] = ASPECTS.landscape) => model.cloudFrame(model.cloudLayout(p, size[0], size[1]), p, t, LENGTH, TITLE);

const BOX = model.frameBox(1920, 1080);
const onScreen = (tile: Tile, box: { ax: number; ay: number }) => tile.opacity > 1e-3 && Math.abs(tile.x) - (tile.w * tile.scale) / 2 < box.ax && Math.abs(tile.y) - (tile.h * tile.scale) / 2 < box.ay;

describe('the media cloud model', () => {
  it('is a pure function of t: any seek order gives the same frame', () => {
    const at = [0.3, 4.1, 8.7, 11.2];
    const forward = at.map((t) => frameAt(t));
    const backward = [...at].reverse().map((t) => frameAt(t)).reverse();

    expect(backward).toEqual(forward);
  });

  it('closes the loop: the last frame matches the first', () => {
    const first = frameAt(0);
    const last = frameAt(LENGTH);

    first.tiles.forEach((tile, i) => {
      expect(last.tiles[i].opacity).toBeCloseTo(tile.opacity, 4);
      if (tile.opacity > 0) {
        expect(last.tiles[i].x).toBeCloseTo(tile.x, 4);
        expect(last.tiles[i].scale).toBeCloseTo(tile.scale, 4);
      }
    });
    expect(last.words.map((w) => w.opacity)).toEqual(first.words.map(() => 0));
  });

  it('flies forward: every tile grows while visible and wraps only when invisible', () => {
    const frames = times().map((t) => frameAt(t));
    for (let i = 1; i < frames.length; i++) {
      frames[i].tiles.forEach((tile, k) => {
        const before = frames[i - 1].tiles[k];
        if (tile.scale < before.scale) {
          expect(Math.max(tile.opacity, before.opacity), `tile ${k} wraps visibly at frame ${i}`).toBeLessThan(1e-3);
        }
      });
    }
  });

  it('never jumps: a visible tile moves a small, steady step per frame', () => {
    const frames = times().map((t) => frameAt(t));
    for (let i = 1; i < frames.length; i++) {
      frames[i].tiles.forEach((tile, k) => {
        const before = frames[i - 1].tiles[k];
        if (onScreen(tile, BOX) && onScreen(before, BOX)) {
          expect(Math.hypot(tile.x - before.x, tile.y - before.y), `tile ${k} frame ${i}`).toBeLessThan(0.05);
          expect(Math.abs(tile.opacity - before.opacity)).toBeLessThan(0.12);
        }
      });
    }
  });

  for (const [name, size] of Object.entries(ASPECTS)) {
    it(`fills the ${name} frame with a dense cloud at every moment`, () => {
      const box = model.frameBox(size[0], size[1]);
      for (const t of times().filter((_, i) => i % 15 === 0)) {
        const visible = frameAt(t, PARAMS, size).tiles.filter((tile) => onScreen(tile, box));
        expect(visible.length, `${name} t=${t}`).toBeGreaterThan(60);
        const quadrants = new Set(visible.map((tile) => `${Math.sign(tile.x)}${Math.sign(tile.y)}`));
        expect(quadrants.size).toBe(4);
      }
    });
  }

  it('keeps every tile small enough to read as a cloud, never a wall', () => {
    for (const t of times().filter((_, i) => i % 3 === 0)) {
      for (const tile of frameAt(t).tiles.filter((tile) => tile.opacity > 0.05)) {
        expect(Math.max(tile.w, tile.h) * tile.scale).toBeLessThan(0.32);
      }
    }
  });

  it('makes tiles near the centre bigger than tiles at the edge', () => {
    const tiles = model.cloudLayout(PARAMS, 1920, 1080) as unknown as { w: number; x: number; y: number }[];
    const box = model.frameBox(1920, 1080);
    const reach = (tile: { x: number; y: number }) => Math.hypot(tile.x / box.ax, tile.y / box.ay);
    const sorted = [...tiles].sort((a, b) => reach(a) - reach(b));
    const mean = (list: { w: number }[]) => list.reduce((a, b) => a + b.w, 0) / list.length;

    expect(mean(sorted.slice(0, 30))).toBeGreaterThan(mean(sorted.slice(-30)) * 1.3);
  });

  it('places the same tiles from the same seed and differently sized ones', () => {
    const tiles = model.cloudLayout(PARAMS, 1920, 1080);

    expect(model.cloudLayout(PARAMS, 1920, 1080)).toEqual(tiles);
    expect(tiles).toHaveLength(PARAMS.count);
    expect(Math.max(...tiles.map((t) => t.w)) / Math.min(...tiles.map((t) => t.w))).toBeGreaterThan(2.5);
  });

  it('draws nearer tiles above farther ones', () => {
    const tiles = frameAt(5).tiles;
    const byDepth = [...tiles].sort((a, b) => b.depth - a.depth);

    byDepth.slice(1).forEach((tile, i) => expect(tile.z).toBeGreaterThanOrEqual(byDepth[i].z));
  });

  it('keeps the far blur barely there', () => {
    for (const tile of frameAt(3).tiles) {
      expect(tile.blur).toBeLessThanOrEqual(PARAMS.blur);
    }
  });

  it('reveals the title late, word by word, moving while it fades', () => {
    const frames = times().map((t) => frameAt(t));
    const firstIn = frames.findIndex((f) => f.words[0].opacity > 0.01);
    const lastIn = frames.findIndex((f) => f.words[2].opacity > 0.5);

    expect(firstIn / FPS).toBeGreaterThanOrEqual(PARAMS.titleAt - 0.01);
    expect(firstIn).toBeLessThan(lastIn);
    const rising = frames.slice(firstIn, firstIn + 20).map((f) => f.words[0].y);
    rising.slice(1).forEach((y, i) => expect(y).toBeLessThan(rising[i]));
  });

  it('clears the tiles from behind the title while it shows', () => {
    const shown = frameAt(9.5);

    expect(shown.clear).toBeCloseTo(1, 3);
    for (const tile of shown.tiles.filter((tile) => Math.abs(tile.x) < TITLE.hw && Math.abs(tile.y) < TITLE.hh)) {
      expect(tile.opacity).toBeLessThan(0.1);
    }
    expect(frameAt(2).clear).toBe(0);
  });

  it('shows no title and clears nothing when the title is empty', () => {
    const p = { ...PARAMS, title: '' };

    expect(frameAt(9.5, p).clear).toBe(0);
    expect(frameAt(9.5, p).words).toEqual([]);
  });
});
