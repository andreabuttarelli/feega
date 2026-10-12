import { describe, expect, it } from 'vitest';
import { GLOBE_MODEL } from './model';

type Tile = { r: number; w: number; h: number; opacity: number; shade: number; facing: number; x: number; y: number; z: number };
type Word = { y: number; opacity: number };
type Frame = { tiles: Tile[]; words: Word[]; veil: number; scale: number; yaw: number };
type Model = {
  globeLayout: (p: object) => object[];
  globeFrame: (layout: object[], p: object, t: number, length: number) => Frame;
};

const model = new Function(`${GLOBE_MODEL}; return { globeLayout, globeFrame };`)() as Model;

const PARAMS = { title: 'the whole world', tiles: 32, tileSize: 0.82, tileAspect: 0.8, radius: 0.34, turns: 1, axisTilt: 14, backDim: 0.75, globeDim: 0.45, push: 0.12, assembleAt: 0, assembleSeconds: 1.4, stagger: 1.2, titleAt: 2.6, leave: true };
const LENGTH = 10;
const FPS = 30;
const times = (until = LENGTH) => Array.from({ length: Math.round(until * FPS) + 1 }, (_, i) => i / FPS);
const frame = (t: number, p: object = PARAMS) => model.globeFrame(model.globeLayout(p), p, t, LENGTH);

describe('the image globe model', () => {
  it('places every tile on the sphere, spread evenly from pole to pole', () => {
    const f = frame(5);
    const ys = f.tiles.map((t) => t.y);
    const fronts = f.tiles.filter((t) => t.facing > 0).length;

    expect(f.tiles).toHaveLength(32);
    f.tiles.forEach((t) => expect(Math.hypot(t.x, t.y, t.z)).toBeCloseTo(PARAMS.radius, 6));
    expect(Math.max(...ys)).toBeGreaterThan(PARAMS.radius * 0.8);
    expect(Math.min(...ys)).toBeLessThan(-PARAMS.radius * 0.8);
    expect(fronts).toBeGreaterThan(10);
    expect(fronts).toBeLessThan(22);
  });

  it('dims the tiles that face away, more the further they turn', () => {
    const tiles = [...frame(5).tiles].sort((a, b) => b.facing - a.facing);

    expect(tiles[0].shade).toBeLessThan(0.05);
    expect(tiles[tiles.length - 1].shade).toBeGreaterThan(0.6);
    tiles.slice(1).forEach((t, i) => expect(t.shade).toBeGreaterThanOrEqual(tiles[i].shade - 1e-9));
  });

  it('builds the globe before the title enters, then dims it under the title', () => {
    const globeBuilt = times().find((t) => frame(t).tiles.every((tile) => tile.opacity > 0.99))!;
    const firstWord = times().find((t) => frame(t).words[0].opacity > 0.01)!;

    expect(frame(0.05).tiles.every((t) => t.opacity < 0.05)).toBe(true);
    expect(firstWord).toBeGreaterThan(globeBuilt - 0.4);
    expect(frame(1).veil).toBe(0);
    expect(frame(6).veil).toBeCloseTo(PARAMS.globeDim, 2);
  });

  it('is a pure function of t: any seek order gives the same frame', () => {
    const at = [0.3, 2, 6.4, 9.8];
    const forward = at.map((t) => frame(t));
    const backward = [...at].reverse().map((t) => frame(t)).reverse();

    expect(backward).toEqual(forward);
  });

  it('closes the loop: the last frame matches the first', () => {
    const first = frame(0);
    const last = frame(LENGTH);

    first.tiles.forEach((t, i) => expect(last.tiles[i].opacity).toBeCloseTo(t.opacity, 4));
    first.words.forEach((w, i) => expect(last.words[i].opacity).toBeCloseTo(w.opacity, 4));
    expect(last.veil).toBeCloseTo(first.veil, 4);
  });

  it('turns forward the whole time, never stopping, jerking or turning back', () => {
    const yaws = times().map((t) => frame(t).yaw);
    const steps = yaws.slice(1).map((y, i) => y - yaws[i]);
    const base = (2 * Math.PI) / (LENGTH * FPS);

    steps.forEach((s) => expect(s).toBeGreaterThan(base * 0.5));
    steps.slice(1).forEach((s, i) => expect(Math.abs(s - steps[i])).toBeLessThan(base * 0.25));
  });

  it('turns a whole number of times per loop', () => {
    const turned = (frame(LENGTH).yaw - frame(0).yaw) / (2 * Math.PI);

    expect(turned).toBeCloseTo(Math.round(turned), 6);
  });

  it('enters monotonically: tiles, words and camera only move forward', () => {
    const path = times(5).map((t) => frame(t));
    path.slice(1).forEach((f, k) => {
      f.tiles.forEach((tile, i) => {
        expect(tile.r).toBeGreaterThanOrEqual(path[k].tiles[i].r - 1e-9);
        expect(tile.opacity).toBeGreaterThanOrEqual(path[k].tiles[i].opacity - 1e-9);
      });
      f.words.forEach((w, i) => expect(w.y).toBeLessThanOrEqual(path[k].words[i].y + 1e-9));
      expect(f.scale).toBeGreaterThanOrEqual(path[k].scale - 1e-9);
    });
  });
});
