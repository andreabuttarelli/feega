import { describe, expect, it } from 'vitest';
import { DrawTool } from '$lib/motion/draw-tool';
import { parsePath, pathData, type Outline } from '$lib/motion/shape/geometry';
import { CanvasTheme } from '$lib/motion/draw-create';
import { drawnOnCanvas } from './canvas-draw';

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

  it('anything else is not a drawing', () => {
    expect(drawnOnCanvas({ component: 'Image', props: {} }, HOST, ZOOM_TWO)).toBeNull();
  });
});
