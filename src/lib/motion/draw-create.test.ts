import { describe, expect, it } from 'vitest';
import { Background, DESIGN_MAX_SIDE, MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { setStill } from '@feega/motion-core/motion/still';
import { COMPONENTS } from '@feega/motion-core/motion/components';
import { DrawTool } from './draw-tool';
import { EditMode } from './edit-mode';
import { CANVAS_INK, CanvasTheme, drawClip, drawStart, drawnElement, drawnFrame, drawnOf, lineOutline, penClip } from './draw-create';
import { parsePath, type Outline } from '@feega/motion-core/motion/shape/geometry';
import type { OpResult } from '@feega/motion-core/motion/timeline';
import { TextSizing } from '@feega/motion-core/motion/text-sizing';
import { FillType } from '@feega/motion-core/motion/fill/model';

const ok = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const video = () => ({ ...newMotionDoc(MotionFormat.Landscape), durationInFrames: 300 });
const still = () => ok(setStill(video(), 0));
const BOX = { x: 0.4, y: 0.3, width: 0.2, height: 0.1 };
const TEXT_LEADING = COMPONENTS.Text.schema.parse({}).leading;

describe('drawing a frame inside a frame', () => {
  it('is a rect Shape container that clips its content and carries its own fill', () => {
    const clip = findClip(ok(drawClip(video(), DrawTool.Frame, BOX, 0, 'f1')), 'f1')!.clip;

    expect(clip.component).toBe('Shape');
    expect(clip.clipContent).toBe(true);
    expect(clip.props).toMatchObject({ shape: 'rect', ...BOX, fills: [{ type: FillType.Solid }] });
  });
});

describe('drawing a stack', () => {
  it('is an empty vertical auto layout, 8 apart, 16 padded, hugging, with no paint', () => {
    const clip = findClip(ok(drawClip(video(), DrawTool.Stack, BOX, 0, 's1')), 's1')!.clip;

    expect(clip.component).toBe('Shape');
    expect(clip.props).toMatchObject({ shape: 'rect', fill: 'transparent', ...BOX });
    expect(clip.autoLayout).toMatchObject({ direction: 'vertical', gap: 8, padding: { top: 16, right: 16, bottom: 16, left: 16 }, order: [] });
    expect(clip.layoutItem).toMatchObject({ width: 'hug', height: 'hug' });
  });

  it('stands alone on the canvas as an element', () => {
    const made = drawnElement({ tool: DrawTool.Stack, box: { left: 10, top: 10, width: 200, height: 100 } }, 's2');

    expect(made.ok).toBe(true);
  });
});

describe('creating an element by drawing inside a frame', () => {
  it('a rectangle is a rect Shape clip on the drawn box', () => {
    const clip = findClip(ok(drawClip(video(), DrawTool.Rectangle, BOX, 0, 'r1')), 'r1')!.clip;

    expect(clip.component).toBe('Shape');
    expect(clip.props).toMatchObject({ shape: 'rect', ...BOX });
  });

  it('a drawn element pivots from its top-left corner', () => {
    const inFrame = findClip(ok(drawClip(video(), DrawTool.Rectangle, BOX, 0, 'r1')), 'r1')!.clip;
    const onCanvas = drawnElement({ tool: DrawTool.Rectangle, box: { left: 100, top: 50, width: 300, height: 100 } }, 'r2');

    expect(inFrame.transform).toEqual({ anchorX: 0, anchorY: 0 });
    expect(onCanvas.ok && findClip(onCanvas.doc, 'r2')!.clip.transform).toEqual({ anchorX: 0, anchorY: 0 });
  });

  it('an ellipse is an ellipse Shape, a text is a Text clip, both on the box', () => {
    expect(findClip(ok(drawClip(video(), DrawTool.Ellipse, BOX, 0, 'e1')), 'e1')!.clip.props).toMatchObject({ shape: 'ellipse', ...BOX });
    const text = findClip(ok(drawClip(video(), DrawTool.Text, BOX, 0, 't1')), 't1')!.clip;
    expect(text.component).toBe('Text');
    expect(text.props).toMatchObject(BOX);
  });

  it('in a video it starts at the playhead; in a still it spans the whole frame', () => {
    const atPlayhead = findClip(ok(drawClip(video(), DrawTool.Rectangle, BOX, 120, 'r1')), 'r1')!.clip;
    expect(atPlayhead.from).toBe(120);
    expect(atPlayhead.from + atPlayhead.durationInFrames).toBe(300);

    const doc = still();
    const onStill = findClip(ok(drawClip(doc, DrawTool.Rectangle, BOX, 40, 'r1')), 'r1')!.clip;
    expect(onStill.from).toBe(0);
    expect(onStill.durationInFrames).toBe(doc.durationInFrames);
  });

  it('in Design a new layer spans the whole video wherever the playhead is; in Motion it starts at the playhead', () => {
    const designed = findClip(ok(drawClip(video(), DrawTool.Rectangle, BOX, drawStart(EditMode.Design, 54), 'r1')), 'r1')!.clip;
    expect(designed.from).toBe(0);
    expect(designed.durationInFrames).toBe(300);

    const animated = findClip(ok(drawClip(video(), DrawTool.Rectangle, BOX, drawStart(EditMode.Motion, 54), 'r1')), 'r1')!.clip;
    expect(animated.from).toBe(54);
  });

  it('drawing in Motion creates base values, never keyframes', () => {
    const drawn = findClip(ok(drawClip(video(), DrawTool.Rectangle, BOX, drawStart(EditMode.Motion, 54), 'r1')), 'r1')!.clip;
    expect(drawn.keyframes).toEqual({});
  });

  it('the select and pen tools draw no box', () => {
    expect(drawClip(video(), DrawTool.Select, BOX, 0, 'x').ok).toBe(false);
    expect(drawClip(video(), DrawTool.Pen, BOX, 0, 'x').ok).toBe(false);
  });
});

describe('a pen path', () => {
  const corner = (x: number, y: number) => ({ p: [x, y] as const, in: [x, y] as const, out: [x, y] as const });

  it('becomes a path Shape boxed on its points, the path in the box own units', () => {
    const outline = [{ closed: true, vertices: [corner(0.2, 0.2), corner(0.6, 0.2), corner(0.6, 0.4)] }];
    const clip = findClip(ok(penClip(video(), outline, 0, 'p1')), 'p1')!.clip;

    expect(clip.props).toMatchObject({ shape: 'path', x: 0.4, y: 0.3, width: 0.4, height: 0.2 });
    const path = parsePath(String(clip.props.path));
    expect(typeof path === 'string' ? path : path[0].vertices.map((v) => v.p)).toEqual([
      [0, 0],
      [1, 0],
      [1, 1]
    ]);
  });

  it('refuses fewer than two points', () => {
    expect(penClip(video(), [{ closed: false, vertices: [corner(0.2, 0.2)] }], 0, 'p1').ok).toBe(false);
  });
});

describe('drawing an element on the canvas, outside any frame', () => {
  const made = (r: ReturnType<typeof drawnElement>) => {
    if (!r.ok) {
      throw new Error(r.error);
    }
    return r;
  };

  it('a rectangle becomes a transparent still doc of the drawn shape, the clip filling it', () => {
    const drawn = made(drawnElement({ tool: DrawTool.Rectangle, box: { left: 100, top: 50, width: 300, height: 100 } }, 'r1'));
    const clip = findClip(drawn.doc, 'r1')!.clip;

    expect(drawn.doc.background).toBe(Background.Transparent);
    expect(drawn.doc.still).toBeTruthy();
    expect(drawn.doc.width / drawn.doc.height).toBeCloseTo(3, 1);
    expect(clip.props).toMatchObject({ shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1 });
    expect(drawn.box).toEqual({ left: 100, top: 50, width: 300, height: 100 });
  });

  it('a pen path takes the box of its points', () => {
    const outline = parsePath('M 10 20 L 110 20 L 110 70') as Outline;
    const drawn = made(drawnElement({ tool: DrawTool.Pen, outline }, 'p1'));

    expect(drawn.box).toEqual({ left: 10, top: 20, width: 100, height: 50 });
    expect(findClip(drawn.doc, 'p1')!.clip.props).toMatchObject({ shape: 'path', x: 0.5, y: 0.5, width: 1, height: 1 });
  });

  it('an arrow drawn from two points is a stroked open path with its head at the end', () => {
    const wire = drawnOf({ tool: DrawTool.Arrow, from: { x: 0, y: 100 }, to: { x: 300, y: 100 } });
    if (typeof wire === 'string') {
      throw new Error(wire);
    }
    const drawn = made(drawnElement(wire, 'a1'));
    const props = findClip(drawn.doc, 'a1')!.clip.props;

    expect(drawn.box.left).toBe(0);
    expect(drawn.box.left + drawn.box.width).toBe(300);
    expect(props).toMatchObject({ shape: 'path', fillKind: 'none', strokeKind: 'solid', stroke: CANVAS_INK[CanvasTheme.Light] });
    expect(String(props.path).match(/L/g)?.length).toBeGreaterThan(1);
  });

  it('a line takes the stroke colour it is given', () => {
    const wire = drawnOf({ tool: DrawTool.Line, from: { x: 0, y: 0 }, to: { x: 100, y: 100 }, stroke: '#ff0000' });
    if (typeof wire === 'string') {
      throw new Error(wire);
    }

    expect(findClip(made(drawnElement(wire, 'l1')).doc, 'l1')!.clip.props).toMatchObject({ stroke: '#ff0000', fillKind: 'none' });
  });

  it('a pasted path keeps its fill, and a stroke-only path draws its stroke without fill', () => {
    const outline = parsePath('M 0 0 L 10 0 L 10 10 Z') as Outline;
    const filled = made(drawnElement({ tool: DrawTool.Pen, outline, fill: '#ff0000' }, 'f1'));
    const stroked = made(drawnElement({ tool: DrawTool.Pen, outline, fill: null, stroke: '#00ff00' }, 's1'));

    expect(findClip(filled.doc, 'f1')!.clip.props).toMatchObject({ fill: '#ff0000', fillKind: 'solid' });
    expect(findClip(stroked.doc, 's1')!.clip.props).toMatchObject({ fillKind: 'none', strokeKind: 'solid', stroke: '#00ff00' });
  });

  it('a pasted path keeps its gradient as a fill layer', () => {
    const outline = parsePath('M 0 0 L 10 0 L 10 10 Z') as Outline;
    const gradient = { type: FillType.Linear as const, stops: [{ color: '#ff0000', pos: 0 }, { color: '#0000ff', pos: 1 }], angle: 90 };
    const drawn = made(drawnElement({ tool: DrawTool.Pen, outline, fill: '#ff0000', gradient }, 'g1'));

    expect(findClip(drawn.doc, 'g1')!.clip.props.fills).toMatchObject([gradient]);
  });

  it('a pasted text keeps its colour', () => {
    const drawn = made(drawnElement({ tool: DrawTool.Text, box: { left: 0, top: 0, width: 200, height: 60 }, text: 'hi', color: '#336699' }, 't3'));

    expect(findClip(drawn.doc, 't3')!.clip.props.color).toBe('#336699');
  });

  it('a pasted text carries its words', () => {
    const drawn = made(drawnElement({ tool: DrawTool.Text, box: { left: 0, top: 0, width: 200, height: 60 }, text: 'hello there' }, 't2'));

    expect(findClip(drawn.doc, 't2')!.clip.props.text).toBe('hello there');
  });

  it('a big box stays inside the frame resolution limits', () => {
    const drawn = made(drawnElement({ tool: DrawTool.Ellipse, box: { left: 0, top: 0, width: 9000, height: 4500 } }, 'e1'));

    expect(drawn.doc.width).toBeLessThanOrEqual(3840);
    expect(drawn.doc.height).toBeLessThanOrEqual(2160);
  });
});

describe('a drawn text shows settled', () => {
  it('its still sits at the end of the clip, where the entrance has finished', () => {
    const drawn = drawnElement({ tool: DrawTool.Text, box: { left: 0, top: 0, width: 200, height: 60 } }, 't1');
    if (!drawn.ok) {
      throw new Error(drawn.error);
    }
    const clip = findClip(drawn.doc, 't1')!.clip;
    expect(drawn.doc.still?.frame).toBe(clip.from + clip.durationInFrames - 1);
  });

  it('its letters are dark ink, readable on the light canvas, not the brand text colour meant for a dark video', () => {
    const drawn = drawnElement({ tool: DrawTool.Text, box: { left: 0, top: 0, width: 200, height: 60 } }, 't1');
    if (!drawn.ok) {
      throw new Error(drawn.error);
    }
    expect(findClip(drawn.doc, 't1')!.clip.props.color).toBe(CANVAS_INK[CanvasTheme.Light]);
  });

  it('on a dark canvas its letters are light ink', () => {
    const drawn = drawnElement({ tool: DrawTool.Text, box: { left: 0, top: 0, width: 200, height: 60 }, theme: CanvasTheme.Dark }, 't1');
    if (!drawn.ok) {
      throw new Error(drawn.error);
    }
    expect(findClip(drawn.doc, 't1')!.clip.props.color).toBe(CANVAS_INK[CanvasTheme.Dark]);
  });

  it('its type fills the drawn box height instead of a body size meant for a full video', () => {
    const drawn = drawnElement({ tool: DrawTool.Text, box: { left: 0, top: 0, width: 300, height: 100 } }, 't1');
    if (!drawn.ok) {
      throw new Error(drawn.error);
    }
    const props = findClip(drawn.doc, 't1')!.clip.props as { size: number };
    const unit = Math.min(drawn.doc.width, drawn.doc.height);
    expect(props.size * unit * TEXT_LEADING).toBeCloseTo(drawn.doc.height, 0);
  });
});

describe('a text drawn inside a frame', () => {
  it('its type fits the drawn box height', () => {
    const doc = video();
    const made = ok(drawClip(doc, DrawTool.Text, BOX, 0, 't1'));
    const props = findClip(made, 't1')!.clip.props as { size: number };
    expect(props.size * Math.min(doc.width, doc.height) * TEXT_LEADING).toBeCloseTo(BOX.height * doc.height, 0);
  });
});

describe('the resizing a drawn text starts with', () => {
  const box = { x: 0.5, y: 0.5, width: 0.3, height: 0.1 };
  const sizingOf = (r: OpResult) => (r.ok ? findClip(r.doc, 'tx')?.clip.props.sizing : null);

  it('a text drawn without a sizing grows with its line', () => {
    expect(sizingOf(drawClip(newMotionDoc(MotionFormat.Landscape), DrawTool.Text, box, 0, 'tx'))).toBe('auto');
  });

  it('a text the chat or an agent draws without a sizing grows with its line', () => {
    const drawn = drawnElement({ tool: DrawTool.Text, box: { left: 0, top: 0, width: 200, height: 40 } }, 'tx');
    expect(drawn.ok ? findClip(drawn.doc, 'tx')?.clip.props.sizing : null).toBe('auto');
  });

  it('a dragged text keeps its width and grows in height', () => {
    expect(sizingOf(drawClip(newMotionDoc(MotionFormat.Landscape), DrawTool.Text, box, 0, 'tx', TextSizing.AutoHeight))).toBe('auto-height');
  });

  it('a free text drawn on the canvas keeps the resizing it was drawn with', () => {
    const made = drawnElement({ tool: DrawTool.Text, box: { left: 0, top: 0, width: 300, height: 80 }, sizing: TextSizing.AutoWidth }, 'tx');
    expect(made.ok && made.doc.tracks.flatMap((t) => t.clips)[0].props.sizing).toBe('auto');
  });
});

describe('drawing a frame in a chosen format', () => {
  const box = { left: 0, top: 0, width: 1080, height: 1350 };

  it('a preset format sizes the frame as a video', () => {
    expect(drawnFrame(box, MotionFormat.Portrait)).toMatchObject({ width: 1080, height: 1350 });
    expect(drawnFrame(box, MotionFormat.Portrait).still).toBeUndefined();
  });

  it('a still second makes it a still graphic holding that frame', () => {
    expect(drawnFrame(box, MotionFormat.Square, 1).still).toEqual({ frame: 30 });
  });

  it('a tall still keeps the shape of its box, so a page drawn into it is not letterboxed', () => {
    const tall = { left: 0, top: 0, width: 1280, height: 14535 };
    const doc = drawnFrame(tall, MotionFormat.Custom, 0);
    const drawnHeight = (doc.width * tall.height) / tall.width;

    expect(Math.abs(doc.height - drawnHeight)).toBeLessThanOrEqual(1);
    expect(doc.height).toBeLessThanOrEqual(DESIGN_MAX_SIDE);
  });

  it('a new frame is filled plain white, not with the brand background', () => {
    const doc = drawnFrame(box);
    const surface = doc.surface ? findClip(doc, doc.surface)?.clip : undefined;

    expect(surface?.props.fills).toEqual([expect.objectContaining({ color: '#FFFFFF' })]);
  });
});

describe('shape tools', () => {
  it.each([
    [DrawTool.Polygon, { shape: 'polygon', sides: 3 }],
    [DrawTool.Star, { shape: 'star', points: 5 }]
  ])('%s draws its shape on the box', (tool, props) => {
    const clip = findClip(ok(drawClip(video(), tool, BOX, 0, 's1')), 's1')!.clip;
    expect(clip.props).toMatchObject({ ...props, ...BOX });
  });

  it('a line is an open two-point path from where the drag started', () => {
    const outline = lineOutline({ x: 10, y: 50 }, { x: 110, y: 0 }, DrawTool.Line);
    expect(outline).toHaveLength(1);
    expect(outline[0].closed).toBe(false);
    expect(outline[0].vertices.map((v) => v.p)).toEqual([
      [10, 50],
      [110, 0]
    ]);
  });

  it('an arrow strokes a head back from the tip, in one open stroke', () => {
    const outline = lineOutline({ x: 0, y: 0 }, { x: 100, y: 0 }, DrawTool.Arrow);
    expect(outline).toHaveLength(1);
    expect(outline[0].closed).toBe(false);
    const points = outline[0].vertices.map((v) => v.p);
    expect(points).toHaveLength(5);
    expect(points[3]).toEqual([100, 0]);
    expect(points[2][0]).toBeLessThan(100);
    expect(points[4][0]).toBeLessThan(100);
  });

  it('a drawn line keeps a stroke and no fill', () => {
    const made = drawnElement({ tool: DrawTool.Pen, outline: lineOutline({ x: 0, y: 0 }, { x: 100, y: 40 }, DrawTool.Line), fill: null, stroke: '#111111' }, 'l1');
    expect(made.ok).toBe(true);
    const clip = made.ok ? findClip(made.doc, 'l1')!.clip : null;
    expect(clip?.props).toMatchObject({ shape: 'path', fillKind: 'none', strokeKind: 'solid', stroke: '#111111' });
  });

  it('a flat line on the canvas gets room around it and a stroke two canvas units wide', () => {
    const made = drawnElement({ tool: DrawTool.Pen, outline: lineOutline({ x: 0, y: 10 }, { x: 200, y: 10 }, DrawTool.Line), fill: null, stroke: '#111111' }, 'l2');
    expect(made.ok).toBe(true);
    if (!made.ok) {
      return;
    }
    expect(made.box.height).toBeGreaterThanOrEqual(24);
    const clip = findClip(made.doc, 'l2')!.clip;
    expect((clip.props.strokeWidth as number) * Math.min(made.box.width, made.box.height)).toBeCloseTo(2, 5);
  });
});

