import { describe, expect, it } from 'vitest';
import { Corner } from './geometry';
import { GestureKind, HitKind, Pointer, clicked, gestureFor, marqueeBox, marqueePick, movedBy, resized, resizedAt } from './gesture';
import { CanvasMode } from '../canvas-mode';

const mouse = { pointer: Pointer.Mouse, button: 0, shift: false, space: false, mode: CanvasMode.Edit };

const NO_KEYS = { shift: false, alt: false };

describe('gestureFor — one row per way a press can start', () => {
  it('a press on a port starts a wire, on a corner a resize, on a node a drag', () => {
    expect(gestureFor({ kind: HitKind.Port, nodeId: 'a', handle: 'text' }, mouse)).toBe(GestureKind.Connect);
    expect(gestureFor({ kind: HitKind.Corner, nodeId: 'a', unit: [1, 1] }, mouse)).toBe(GestureKind.Resize);
    expect(gestureFor({ kind: HitKind.Node, nodeId: 'a' }, mouse)).toBe(GestureKind.Drag);
  });

  it('left-drag on empty canvas draws a marquee on desktop, pans on touch', () => {
    expect(gestureFor({ kind: HitKind.Empty }, mouse)).toBe(GestureKind.Marquee);
    expect(gestureFor({ kind: HitKind.Empty }, { ...mouse, pointer: Pointer.Touch })).toBe(GestureKind.Pan);
  });

  it('middle or right button, or space held, always pans', () => {
    expect(gestureFor({ kind: HitKind.Node, nodeId: 'a' }, { ...mouse, button: 1 })).toBe(GestureKind.Pan);
    expect(gestureFor({ kind: HitKind.Empty }, { ...mouse, button: 2 })).toBe(GestureKind.Pan);
    expect(gestureFor({ kind: HitKind.Node, nodeId: 'a' }, { ...mouse, space: true })).toBe(GestureKind.Pan);
  });

  it('view mode only pans', () => {
    const view = { ...mouse, mode: CanvasMode.View };
    expect(gestureFor({ kind: HitKind.Node, nodeId: 'a' }, view)).toBe(GestureKind.Pan);
    expect(gestureFor({ kind: HitKind.Port, nodeId: 'a', handle: null }, view)).toBe(GestureKind.Pan);
  });

  it('a press on an edge picks it', () => {
    expect(gestureFor({ kind: HitKind.Edge, edgeId: 'e' }, mouse)).toBe(GestureKind.PickEdge);
  });
});

describe('selection on click', () => {
  it('a plain click selects only the node, unless it was already in the selection', () => {
    expect(clicked(['a', 'b'], 'c', false)).toEqual(['c']);
    expect(clicked(['a', 'b'], 'b', false)).toEqual(['a', 'b']);
  });

  it('shift toggles', () => {
    expect(clicked(['a'], 'b', true)).toEqual(['a', 'b']);
    expect(clicked(['a', 'b'], 'a', true)).toEqual(['b']);
  });
});

describe('drag, resize, marquee', () => {
  it('moves every dragged node by the same world delta', () => {
    const origins = new Map([['a', { x: 0, y: 0 }], ['b', { x: 10, y: 20 }]]);
    expect(movedBy(origins, { x: 5, y: -5 })).toEqual([
      { id: 'a', x: 5, y: -5 },
      { id: 'b', x: 15, y: 15 }
    ]);
  });

  it('resizes from any corner and never below the minimum', () => {
    const box = { x: 0, y: 0, w: 100, h: 100 };
    expect(resized(box, Corner.BottomRight, { x: 20, y: 10 }, { w: 50, h: 50 })).toEqual({ x: 0, y: 0, w: 120, h: 110 });
    expect(resized(box, Corner.TopLeft, { x: 20, y: 10 }, { w: 50, h: 50 })).toEqual({ x: 20, y: 10, w: 80, h: 90 });
    expect(resized(box, Corner.TopLeft, { x: 90, y: 90 }, { w: 50, h: 50 })).toEqual({ x: 50, y: 50, w: 50, h: 50 });
  });

  it('a side handle resizes only its side, the opposite side stays put', () => {
    const box = { x: 0, y: 0, w: 100, h: 50 };
    expect(resizedAt(box, [1, 0.5], { x: 30, y: 40 }, { w: 1, h: 1 }, NO_KEYS, 0)).toEqual({ x: 0, y: 0, w: 130, h: 50 });
    expect(resizedAt(box, [0.5, 0], { x: 30, y: 10 }, { w: 1, h: 1 }, NO_KEYS, 0)).toEqual({ x: 0, y: 10, w: 100, h: 40 });
  });

  it('Alt resizes from the centre, Shift keeps the ratio', () => {
    const box = { x: 0, y: 0, w: 100, h: 50 };
    expect(resizedAt(box, [1, 0.5], { x: 20, y: 0 }, { w: 1, h: 1 }, { shift: false, alt: true }, 0)).toEqual({ x: -20, y: 0, w: 140, h: 50 });
    expect(resizedAt(box, [1, 0.5], { x: 100, y: 0 }, { w: 1, h: 1 }, { shift: true, alt: false }, 0)).toEqual({ x: 0, y: -25, w: 200, h: 100 });
  });

  it('a rotated box keeps its opposite side fixed in the world', () => {
    const box = { x: 0, y: 0, w: 100, h: 50 };
    const out = resizedAt(box, [1, 0.5], { x: 0, y: 20 }, { w: 1, h: 1 }, NO_KEYS, 90);
    expect(out.w).toBeCloseTo(120);
    expect(out.h).toBeCloseTo(50);
    const leftMid = (b: typeof box) => ({ x: b.x + b.w / 2 - Math.cos(Math.PI / 2) * (b.w / 2), y: b.y + b.h / 2 - Math.sin(Math.PI / 2) * (b.w / 2) });
    expect(leftMid(out).x).toBeCloseTo(leftMid(box).x);
    expect(leftMid(out).y).toBeCloseTo(leftMid(box).y);
  });

  it('a marquee picks every tile it touches, added to the selection with shift', () => {
    const tiles = [
      { id: 'a', x: 0, y: 0, w: 10, h: 10 },
      { id: 'b', x: 100, y: 100, w: 10, h: 10 }
    ];
    const box = marqueeBox({ x: 15, y: 15 }, { x: 5, y: 5 });
    expect(box).toEqual({ x: 5, y: 5, w: 10, h: 10 });
    expect(marqueePick(tiles, box, [], false)).toEqual(['a']);
    expect(marqueePick(tiles, box, ['b'], true)).toEqual(['b', 'a']);
  });
});
