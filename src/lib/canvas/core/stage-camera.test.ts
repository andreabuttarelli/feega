import { describe, expect, it } from 'vitest';
import { cameraFrom, Restage, restageFor } from './stage-camera';

describe('stage camera', () => {
  it('maps the staged view onto the current one: same view is the identity', () => {
    expect(cameraFrom({ x: 10, y: 20, zoom: 2 }, { x: 10, y: 20, zoom: 2 }, 1)).toEqual([1, 0, 0, 1, 0, 0]);
  });

  it('a pan is a translation in device pixels', () => {
    expect(cameraFrom({ x: 0, y: 0, zoom: 1 }, { x: 30, y: -10, zoom: 1 }, 2)).toEqual([1, 0, 0, 1, 60, -20]);
  });

  it('a zoom scales about the staged origin and keeps world points under the camera', () => {
    const [s, , , , tx] = cameraFrom({ x: 100, y: 0, zoom: 1 }, { x: 50, y: 0, zoom: 2 }, 1);
    const world = 40;
    expect(s * (100 + world * 1) + tx).toBe(50 + world * 2);
  });

  it('restages when a pan leaves the staged reach, or the zoom drifts enough to soften', () => {
    const screen = { width: 800, height: 600 };
    expect(restageFor({ x: 0, y: 0, zoom: 1 }, { x: 100, y: 0, zoom: 1 }, screen, 400)).toBe(Restage.No);
    expect(restageFor({ x: 0, y: 0, zoom: 1 }, { x: 500, y: 0, zoom: 1 }, screen, 400)).toBe(Restage.Now);
    expect(restageFor({ x: 0, y: 0, zoom: 1 }, { x: 0, y: 0, zoom: 2 }, screen, 400)).toBe(Restage.Now);
    expect(restageFor({ x: 0, y: 0, zoom: 1 }, { x: 0, y: 0, zoom: 1.1 }, screen, 400)).toBe(Restage.WhenIdle);
  });
});
