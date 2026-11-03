import { describe, expect, it } from 'vitest';
import { DrawTool } from '$lib/motion/draw-tool';
import { parsePath, pathData, type Outline } from '@feega/motion-core/motion/shape/geometry';
import { CANVAS_INK, CanvasTheme } from '$lib/motion/draw-create';
import { TEXT_CLICK_PX, canvasTextClick, drawnInFrame, drawnOnCanvas } from './canvas-draw';
import { COMPONENTS } from '@feega/motion-core/motion/components';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { drawFrame, prepare } from '@feega/motion-core/motion/gpu-full/display-list';
import { FEEGA_TOKENS, resolveColor } from '@feega/motion-core/motion/brand';
import { DEFAULT_COLOUR } from '@feega/motion-core/motion/default-colours';

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

  it('a stack drawn with the Stack tool stays a stack, not a rectangle', () => {
    const box = { x: 0.5, y: 0.5, width: 0.2, height: 0.1 };
    const stack = { component: 'Shape', props: { shape: 'rect', fill: 'transparent', ...box }, autoLayout: { direction: 'vertical' } };

    expect(drawnOnCanvas(stack, HOST, ZOOM_TWO)?.tool).toBe(DrawTool.Stack);
  });

  it('a text carries the theme of the canvas it was drawn on', () => {
    const clip = { component: 'Text', props: { text: 'Text', x: 0.5, y: 0.5, width: 0.2, height: 0.1 } };

    expect(drawnOnCanvas(clip, HOST, ZOOM_TWO, CanvasTheme.Dark)).toMatchObject({ tool: DrawTool.Text, theme: CanvasTheme.Dark });
  });

  it('a pen path is written in canvas units, stroked in ink with no fill like any pen', () => {
    const clip = { component: 'Shape', props: { shape: 'path', path: 'M 0 0 L 1 1', x: 0.5, y: 0.5, width: 0.2, height: 0.1 } };

    expect(drawnOnCanvas(clip, HOST, ZOOM_TWO)).toEqual({ tool: DrawTool.Pen, path: pathData(parsePath('M 200 112.5 L 300 137.5') as Outline), fill: null, stroke: CANVAS_INK[CanvasTheme.Light] });
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

  it('a stroked path takes the ink the frame tools draw with, not the canvas one', () => {
    const made = drawnInFrame(sheet(), FRAME, { tool: DrawTool.Pen, path: 'M 200 100 L 700 500', fill: null, stroke: CANVAS_INK[CanvasTheme.Dark] }, 0, 'p2');

    expect(made.ok && clipOf(made.doc, 'p2')?.props).toMatchObject({ fillKind: 'none', stroke: DEFAULT_COLOUR.ink });
  });

  it('a pen path in a frame is a black 1 px line with no fill, as in Figma', () => {
    const made = drawnInFrame(sheet(), FRAME, { tool: DrawTool.Pen, path: 'M 200 100 L 700 500' }, 0, 'p3');

    expect(made.ok && clipOf(made.doc, 'p3')?.props).toMatchObject({ fillKind: 'none', strokeKind: 'solid', stroke: DEFAULT_COLOUR.ink, strokeWidth: 1 / 800 });
  });

  it('a line drawn from the canvas into a white frame stays visible on it', () => {
    const made = drawnInFrame(sheet(), FRAME, { tool: DrawTool.Line, from: { x: 300, y: 200 }, to: { x: 400, y: 300 } }, 0, 'l1');
    const stroke = made.ok ? clipOf(made.doc, 'l1')?.props.stroke : null;

    expect(resolveColor(stroke, FEEGA_TOKENS)).toBe(DEFAULT_COLOUR.ink);
  });
});

describe('a click with the text tool on the canvas', () => {
  const leading = COMPONENTS.Text.schema.parse({}).leading as number;

  it('makes a box for 16 px type, whatever the zoom', () => {
    expect(TEXT_CLICK_PX.size).toBe(16);
    const atTwo = canvasTextClick((p) => ({ x: p.x / 2, y: p.y / 2 }));
    expect(atTwo.height).toBeCloseTo(16 * leading * 2);
    const atOne = canvasTextClick((p) => p);
    expect(atOne.height).toBeCloseTo(16 * leading);
  });
});
