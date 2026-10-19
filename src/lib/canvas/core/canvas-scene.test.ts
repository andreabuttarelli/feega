import { describe, expect, it } from 'vitest';
import { canvasScene, type FrameOnCanvas, type SceneLook } from './canvas-scene';
import { ItemKind, Unsupported, type DisplayList, type PathItem } from '$lib/motion/gpu-full/display-list';
import { FillRule, PaintKind } from '$lib/motion/gpu-full/paint';
import { BlendMode } from '$lib/motion/blend';
import type { ComponentId } from '$lib/motion/components';

const LOOK: SceneLook = { background: [1, 1, 1, 1], selection: [0, 0.4, 1, 1], selectionWidth: 2 };
const SCREEN = { width: 800, height: 600 };

const square = (clip: string): PathItem => ({ kind: ItemKind.Path, clip, contours: [[0, 0, 10, 0, 10, 10, 0, 10]], rule: FillRule.NonZero, paint: { kind: PaintKind.Solid, color: [1, 0, 0, 1] }, opacity: 1, matrix: [1, 0, 0, 1, 5, 5], blur: 4, blend: BlendMode.Normal });

const doc = (items: PathItem[]): DisplayList => ({ width: 100, height: 50, background: [0, 0, 0, 1], items, unsupported: [] });

const frame = (id: string, x: number): FrameOnCanvas => ({ id, box: { x, y: 0, w: 200, h: 100 }, list: doc([square(`${id}-a`)]) });

const paths = (list: DisplayList) => list.items as PathItem[];

describe('canvas scene', () => {
  it('draws the frame live from its doc: background, then each item through the camera', () => {
    const [bg, item] = paths(canvasScene([frame('f', 0)], { x: 10, y: 20, zoom: 0.5 }, SCREEN, new Set(), LOOK));
    expect(bg.paint).toEqual({ kind: PaintKind.Solid, color: [0, 0, 0, 1] });
    expect(item.matrix).toEqual([1, 0, 0, 1, 15, 25]);
    expect(item.blur).toBe(4);
  });

  it('clips every item to its frame on screen', () => {
    const scene = canvasScene([frame('f', 100)], { x: 0, y: 0, zoom: 1 }, SCREEN, new Set(), LOOK);
    expect(paths(scene)[1].scissor).toEqual([100, 0, 300, 100]);
  });

  it('skips frames outside the viewport, so off-screen docs cost nothing', () => {
    const clips = canvasScene([frame('in', 0), frame('out', 5000)], { x: 0, y: 0, zoom: 1 }, SCREEN, new Set(), LOOK).items.map((i) => i.clip);
    expect(clips).toContain('in-a');
    expect(clips).not.toContain('out-a');
  });

  it('outlines selected frames on top, at a constant screen width', () => {
    const ring = paths(canvasScene([frame('f', 0)], { x: 0, y: 0, zoom: 3 }, SCREEN, new Set(['f']), LOOK)).at(-1)!;
    expect(ring.clip).toBe('selection:f');
    expect(ring.rule).toBe(FillRule.EvenOdd);
    expect(ring.contours[0]).toEqual([-2, -2, 602, -2, 602, 302, -2, 302]);
  });

  it('carries the canvas background and the screen size', () => {
    expect(canvasScene([], { x: 0, y: 0, zoom: 1 }, SCREEN, new Set(), LOOK)).toMatchObject({ width: 800, height: 600, background: [1, 1, 1, 1], items: [] });
  });

  it('keeps what a frame cannot draw named', () => {
    const f = frame('f', 0);
    f.list.unsupported = [{ clip: 'c', component: 'Custom' as ComponentId, reason: Object.values(Unsupported)[0] }];
    expect(canvasScene([f], { x: 0, y: 0, zoom: 1 }, SCREEN, new Set(), LOOK).unsupported).toHaveLength(1);
  });
});
