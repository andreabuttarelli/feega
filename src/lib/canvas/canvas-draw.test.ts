import { describe, expect, it } from 'vitest';
import { DrawTool } from '$lib/motion/draw-tool';
import { parsePath, pathData, type Outline } from '@feega/motion-core/motion/shape/geometry';
import { CANVAS_INK, CanvasTheme } from '$lib/motion/draw-create';
import { drawnInFrame, drawnOnCanvas } from './canvas-draw';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { drawFrame, prepare } from '@feega/motion-core/motion/gpu-full/display-list';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';

const HOST = { left: 100, top: 50, width: 1000, height: 500 };
const ZOOM_TWO = (p: { x: number; y: number }) => ({ x: (p.x - 100) / 2, y: (p.y - 50) / 2 });

describe('a shape drawn over the canvas lands in canvas units', () => {
  it('a rectangle drawn on the screen keeps its place and size at the current zoom', () => {
    const clip = { component: 'Shape', props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.2, height: 0.1 } };

    expect(drawnOnCanvas(clip, HOST, ZOOM_TWO)).toEqual({ tool: DrawTool.Rectangle, box: { left: 200, top: 112.5, width: 100, height: 25 }, theme: CanvasTheme.Light });
  });

  it('an ellipse and a text keep their tool', () => {
    const box = { x: 0.5, y: 0.5, width: 0.2, height: 0.1 };

    expect(drawnOnCanvas({ component: 'Shape', props: { shape: 'ellipse', ...box } }, HOST, ZOOM_TWO)?.tool).toBe(DrawTool.Ellipse);
    expect(drawnOnCanvas({ component: 'Text', props: { text: 'Text', ...box } }, HOST, ZOOM_TWO)?.tool).toBe(DrawTool.Text);
  });

  it('a text carries the theme of the canvas it was drawn on', () => {
    const clip = { component: 'Text', props: { text: 'Text', x: 0.5, y: 0.5, width: 0.2, height: 0.1 } };

    expect(drawnOnCanvas(clip, HOST, ZOOM_TWO, CanvasTheme.Dark)).toMatchObject({ tool: DrawTool.Text, theme: CanvasTheme.Dark });
  });

  it('a pen path is written in canvas units', () => {
    const clip = { component: 'Shape', props: { shape: 'path', path: 'M 0 0 L 1 1', x: 0.5, y: 0.5, width: 0.2, height: 0.1 } };

    expect(drawnOnCanvas(clip, HOST, ZOOM_TWO)).toEqual({ tool: DrawTool.Pen, path: pathData(parsePath('M 200 112.5 L 300 137.5') as Outline) });
  });

  it('a polygon and a star keep their tool', () => {
    const box = { x: 0.5, y: 0.5, width: 0.2, height: 0.1 };

    expect(drawnOnCanvas({ component: 'Shape', props: { shape: 'polygon', ...box } }, HOST, ZOOM_TWO)?.tool).toBe(DrawTool.Polygon);
    expect(drawnOnCanvas({ component: 'Shape', props: { shape: 'star', ...box } }, HOST, ZOOM_TWO)?.tool).toBe(DrawTool.Star);
  });

  it('a stroked path keeps its stroke and missing fill, inked for the canvas theme', () => {
    const clip = { component: 'Shape', props: { shape: 'path', path: 'M 0 0 L 1 1', fillKind: 'none', strokeKind: 'solid', stroke: 'brand.text', x: 0.5, y: 0.5, width: 0.2, height: 0.1 } };

    expect(drawnOnCanvas(clip, HOST, ZOOM_TWO, CanvasTheme.Dark)).toMatchObject({ tool: DrawTool.Pen, fill: null, stroke: CANVAS_INK[CanvasTheme.Dark] });
  });

  it('anything else is not a drawing', () => {
    expect(drawnOnCanvas({ component: 'Image', props: {} }, HOST, ZOOM_TWO)).toBeNull();
  });
});

describe('a shape drawn over a frame lands inside it, on the gesture', () => {
  const FRAME = { x: 200, y: 100, w: 500, h: 400 };
  const sheet = () => ({ ...newMotionDoc(MotionFormat.Landscape), width: 1000, height: 800 });
  const clipOf = (doc: MotionDoc, id: string) => doc.tracks.flatMap((t) => t.clips).find((c) => c.id === id);

  it('a rectangle keeps its place and size in the frame', () => {
    const made = drawnInFrame(sheet(), FRAME, { tool: DrawTool.Rectangle, box: { left: 300, top: 200, width: 100, height: 40 } }, 0, 'r1');

    expect(made.ok && clipOf(made.doc, 'r1')?.props).toMatchObject({ shape: 'rect', x: 0.3, y: 0.3, width: 0.2, height: 0.1 });
  });

  it('is in the display list the gpu draws, before any save', () => {
    const made = drawnInFrame(sheet(), FRAME, { tool: DrawTool.Ellipse, box: { left: 300, top: 200, width: 100, height: 40 } }, 0, 'e1');

    expect(made.ok && drawFrame(prepare(made.doc, FEEGA_TOKENS), 0).items.map((i) => i.clip)).toContain('e1');
  });

  it('a pen path is written in the units of the frame', () => {
    const made = drawnInFrame(sheet(), FRAME, { tool: DrawTool.Pen, path: 'M 200 100 L 700 500' }, 0, 'p1');

    expect(made.ok && clipOf(made.doc, 'p1')?.props).toMatchObject({ shape: 'path', x: 0.5, y: 0.5, width: 1, height: 1 });
  });

  it('a stroked path takes the ink of the frame, not of the canvas', () => {
    const made = drawnInFrame(sheet(), FRAME, { tool: DrawTool.Pen, path: 'M 200 100 L 700 500', fill: null, stroke: CANVAS_INK[CanvasTheme.Light] }, 0, 'p2');

    expect(made.ok && clipOf(made.doc, 'p2')?.props).toMatchObject({ fillKind: 'none', stroke: 'brand.text' });
  });
});
