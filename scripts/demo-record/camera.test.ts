import { describe, expect, it } from 'vitest';
import { Aspect, cameraAt, keyframesOf, type DemoEvent } from './camera';

const VIEW = { width: 1600, height: 900 };
const click = (t: number, x: number, y: number): DemoEvent => ({ kind: 'click', t, x, y });

describe('demo camera', () => {
  it('starts wide on the whole viewport', () => {
    const keys = keyframesOf([click(3, 400, 300)], VIEW, 6);
    expect(cameraAt(keys, 0, VIEW, Aspect.Landscape)).toEqual({ x: 0, y: 0, width: 1600, height: 900 });
  });

  it('is zoomed toward the click when it lands', () => {
    const keys = keyframesOf([click(3, 400, 300)], VIEW, 8);
    const at = cameraAt(keys, 3, VIEW, Aspect.Landscape);
    expect(at.width).toBeLessThan(VIEW.width / 1.7);
    expect(at.x).toBeLessThan(400);
    expect(at.x + at.width).toBeGreaterThan(400);
    expect(at.y + at.height).toBeGreaterThan(300);
  });

  it('eases back out after the hold', () => {
    const keys = keyframesOf([click(1, 400, 300)], VIEW, 8);
    expect(cameraAt(keys, 7.9, VIEW, Aspect.Landscape).width).toBe(VIEW.width);
  });

  it('zooms to fit a typed field', () => {
    const keys = keyframesOf([{ kind: 'type', t: 2, end: 4, rect: { x: 600, y: 400, width: 300, height: 40 } }], VIEW, 8);
    const at = cameraAt(keys, 3, VIEW, Aspect.Landscape);
    expect(at.x).toBeLessThanOrEqual(600);
    expect(at.x + at.width).toBeGreaterThanOrEqual(900);
    expect(at.width).toBeLessThan(VIEW.width / 1.7);
  });

  it('a pick in the side panel keeps the stage it changes in shot', () => {
    const stage = { x: 560, y: 420, width: 520, height: 300 };
    const keys = keyframesOf([{ kind: 'click', t: 2, x: 1500, y: 480, fit: stage }], VIEW, 8);
    const at = cameraAt(keys, 3, VIEW, Aspect.Landscape);
    expect(at.x).toBeLessThanOrEqual(stage.x);
    expect(at.x + at.width).toBeGreaterThanOrEqual(1500);
    expect(at.y).toBeLessThanOrEqual(stage.y);
    expect(at.y + at.height).toBeGreaterThanOrEqual(stage.y + stage.height);
  });

  it('keeps a portrait window inside the viewport', () => {
    const keys = keyframesOf([click(2, 1590, 10)], VIEW, 6);
    for (const t of [0, 1, 2, 3, 5]) {
      const at = cameraAt(keys, t, VIEW, Aspect.Portrait);
      expect(at.width / at.height).toBeCloseTo(9 / 16, 2);
      expect(at.x).toBeGreaterThanOrEqual(0);
      expect(at.x + at.width).toBeLessThanOrEqual(VIEW.width + 0.001);
      expect(at.y).toBeGreaterThanOrEqual(0);
    }
  });
});
