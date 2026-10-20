import { describe, expect, it } from 'vitest';
import { baseRatio, cellBox, cellBytes, cellCss, detailRatio, neededCells, softPosters } from './detail-plan';

const TALL = { x: 0, y: 0, w: 1440, h: 6000 };

describe('detail plan', () => {
  it('a tall frame is shot below 2x, so its base is the snapshot edge over its height', () => {
    expect(baseRatio(TALL, 2, 8192)).toBeCloseTo(8192 / 6000);
    expect(baseRatio({ x: 0, y: 0, w: 400, h: 300 }, 2, 8192)).toBe(2);
  });

  it('no detail while the base already covers the screen resolution', () => {
    expect(detailRatio(1, 2, 2)).toBeNull();
    expect(detailRatio(1.2, 2, 2)).toBeNull();
  });

  it('zoom 3 on a DPR 2 screen asks for the 6x step', () => {
    expect(detailRatio(3, 2, 2)).toBe(6);
  });

  it('never asks beyond the highest step', () => {
    expect(detailRatio(20, 3, 2)).toBe(8);
  });

  it('a cell is never larger than 4096 device pixels', () => {
    for (const r of [2, 3, 4, 6, 8]) {
      expect(cellCss(r) * r).toBeLessThanOrEqual(4096);
    }
  });

  it('only the cells around the viewport are needed on a tall frame', () => {
    const size = cellCss(6);
    const cells = neededCells(TALL, { x: 100, y: 3000, w: 500, h: 300 }, size);
    expect(cells.length).toBeLessThan(6);
    expect(cells.every((c) => c.cy >= Math.floor(2925 / size) && c.cy <= Math.floor(3375 / size))).toBe(true);
  });

  it('a frame off screen needs no cells', () => {
    expect(neededCells(TALL, { x: 5000, y: 0, w: 500, h: 300 }, 600)).toEqual([]);
  });

  it('edge cells are trimmed to the frame and cost their own bytes', () => {
    const box = cellBox(TALL, 682, { cx: 2, cy: 8 });
    expect(box).toEqual({ x: 1364, y: 5456, w: 76, h: 544 });
    expect(cellBytes(box, 6)).toBe(456 * 3264 * 4);
  });
});

describe('soft posters', () => {
  const POSTER = 480;
  const view = { x: 0, y: 0, zoom: 3 };
  const screen = { width: 1440, height: 900 };
  const tile = (id: string, x: number, w = 1440, h = 4735) => ({ id, x, y: 0, w, h });

  it('a 1440 px landing at zoom 3 is promoted to live, since its 480 px poster is far too small', () => {
    expect(softPosters([tile('a', 0)], view, screen, 2, POSTER, 4)).toEqual(['a']);
  });

  it('a frame whose poster still covers the screen is left alone', () => {
    expect(softPosters([tile('a', 0, 400, 300)], { x: 0, y: 0, zoom: 0.5 }, screen, 1, POSTER, 4)).toEqual([]);
  });

  it('a frame off screen is not promoted', () => {
    expect(softPosters([tile('a', 99999)], view, screen, 2, POSTER, 4)).toEqual([]);
  });

  it('at most the cap, largest on screen first', () => {
    const many = [tile('small', 0, 300, 200), tile('big', 0, 1440, 4735), tile('mid', 0, 800, 600)];
    expect(softPosters(many, { x: 0, y: 0, zoom: 1 }, screen, 2, POSTER, 2)).toEqual(['big', 'mid']);
  });
});
