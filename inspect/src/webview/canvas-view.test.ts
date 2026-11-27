import { describe, expect, it } from 'vitest';
import { CANVAS_MAX_ZOOM, CANVAS_MIN_ZOOM, CanvasKey, canvasKeyOf, fitView, panBy, percentOf, stepView, wheelOf, zoomAround } from './canvas-view';

const press = (over: Partial<Parameters<typeof canvasKeyOf>[0]> = {}) => ({ key: '', code: '', shiftKey: false, metaKey: false, ctrlKey: false, ...over });
const wheel = (over: Partial<Parameters<typeof wheelOf>[0]> = {}) => ({ deltaX: 0, deltaY: 0, ctrlKey: false, metaKey: false, ...over });

describe('zoomAround', () => {
  it('keeps the world point under the cursor fixed', () => {
    const view = { scale: 0.5, x: 20, y: -10 };
    const at = { x: 100, y: 60 };
    const next = zoomAround(view, 2, at);

    expect(next.scale).toBe(1);
    expect((at.x - next.x) / next.scale).toBeCloseTo((at.x - view.x) / view.scale);
    expect((at.y - next.y) / next.scale).toBeCloseTo((at.y - view.y) / view.scale);
  });

  it('stops at the bounds without drifting', () => {
    expect(zoomAround({ scale: CANVAS_MAX_ZOOM, x: 5, y: 5 }, 2, { x: 50, y: 50 })).toEqual({ scale: CANVAS_MAX_ZOOM, x: 5, y: 5 });
    expect(zoomAround({ scale: CANVAS_MIN_ZOOM, x: 5, y: 5 }, 0.5, { x: 50, y: 50 })).toEqual({ scale: CANVAS_MIN_ZOOM, x: 5, y: 5 });
  });
});

describe('stepView', () => {
  it('zooms by a fixed ratio around the viewport centre', () => {
    const viewport = { w: 800, h: 600 };
    const next = stepView({ scale: 1, x: 0, y: 0 }, 1, viewport);

    expect(next.scale).toBeGreaterThan(1);
    expect((400 - next.x) / next.scale).toBeCloseTo(400);
    expect(stepView(next, -1, viewport).scale).toBeCloseTo(1);
  });
});

describe('panBy', () => {
  it('moves the world by the drag', () => {
    expect(panBy({ scale: 2, x: 10, y: 10 }, -4, 6)).toEqual({ scale: 2, x: 6, y: 16 });
  });
});

describe('fitView', () => {
  const viewport = { w: 1000, h: 500 };

  it('shows all the bounds, centred, with padding', () => {
    const view = fitView({ x: 0, y: 0, width: 2000, height: 500 }, viewport);

    expect(view.scale).toBeLessThan(0.5);
    expect(view.x + 1000 * view.scale).toBeCloseTo(500);
    expect(view.y + 250 * view.scale).toBeCloseTo(250);
  });

  it('never zooms in past real size', () => {
    expect(fitView({ x: 0, y: 0, width: 10, height: 10 }, viewport).scale).toBe(1);
  });

  it('never zooms out past the minimum', () => {
    expect(fitView({ x: 0, y: 0, width: 1e7, height: 1e7 }, viewport).scale).toBe(CANVAS_MIN_ZOOM);
  });

  it('rests at the origin when there is nothing to show', () => {
    expect(fitView({ x: 0, y: 0, width: 0, height: 0 }, viewport)).toEqual({ scale: 1, x: 0, y: 0 });
  });
});

describe('wheelOf', () => {
  it.each([
    ['cmd wheel', wheel({ metaKey: true, deltaY: -10 }), 'zoom'],
    ['ctrl wheel', wheel({ ctrlKey: true, deltaY: 10 }), 'zoom'],
    ['plain wheel', wheel({ deltaX: 3, deltaY: 8 }), 'pan']
  ])('%s is a %s', (_, e, kind) => {
    expect(wheelOf(e).kind).toBe(kind);
  });

  it('zooms in on up, out on down', () => {
    const up = wheelOf(wheel({ ctrlKey: true, deltaY: -10 }));
    const down = wheelOf(wheel({ ctrlKey: true, deltaY: 10 }));

    expect(up.kind === 'zoom' && up.factor).toBeGreaterThan(1);
    expect(down.kind === 'zoom' && down.factor).toBeLessThan(1);
  });

  it('pans against the scroll, like a trackpad', () => {
    expect(wheelOf(wheel({ deltaX: 3, deltaY: 8 }))).toEqual({ kind: 'pan', dx: -3, dy: -8 });
  });
});

describe('percentOf', () => {
  it('rounds the scale', () => {
    expect(percentOf(0.3333)).toBe('33%');
  });
});

describe('canvasKeyOf', () => {
  it.each([
    [press({ key: '+', code: 'Equal', shiftKey: true }), CanvasKey.In],
    [press({ key: '=', code: 'Equal' }), CanvasKey.In],
    [press({ key: '=', code: 'Equal', metaKey: true }), CanvasKey.In],
    [press({ key: '-', code: 'Minus' }), CanvasKey.Out],
    [press({ key: '-', code: 'Minus', ctrlKey: true }), CanvasKey.Out],
    [press({ key: '0', code: 'Digit0' }), CanvasKey.Fit],
    [press({ key: '!', code: 'Digit1', shiftKey: true }), CanvasKey.Fit],
    [press({ key: ')', code: 'Digit0', shiftKey: true }), CanvasKey.Actual],
    [press({ key: 'Escape', code: 'Escape' }), CanvasKey.Close],
    [press({ key: 'a', code: 'KeyA' }), null]
  ])('%o', (e, key) => {
    expect(canvasKeyOf(e)).toBe(key);
  });
});
