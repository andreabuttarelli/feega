import { describe, expect, it } from 'vitest';
import { Background, MotionFormat, findClip, newMotionDoc, type MotionDoc } from './doc';
import { setStill } from './still';
import { COMPONENTS } from './components';
import { DrawTool } from './draw-tool';
import { CANVAS_INK, CanvasTheme, drawClip, drawnElement, drawnFrame, penClip } from './draw-create';
import { parsePath, type Outline } from './shape/geometry';
import type { OpResult } from './timeline';
import { TextSizing } from './text-sizing';

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
    expect(atPlayhead.from + atPlayhead.durationInFrames).toBeLessThanOrEqual(300);

    const doc = still();
    const onStill = findClip(ok(drawClip(doc, DrawTool.Rectangle, BOX, 40, 'r1')), 'r1')!.clip;
    expect(onStill.from).toBe(0);
    expect(onStill.durationInFrames).toBe(doc.durationInFrames);
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

  it('a big box stays inside the frame resolution limits', () => {
    const drawn = made(drawnElement({ tool: DrawTool.Ellipse, box: { left: 0, top: 0, width: 5000, height: 2500 } }, 'e1'));

    expect(drawn.doc.width).toBeLessThanOrEqual(1920);
    expect(drawn.doc.height).toBeLessThanOrEqual(1080);
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

  it('a dragged text keeps its width and grows in height', () => {
    expect(sizingOf(drawClip(newMotionDoc(MotionFormat.Landscape), DrawTool.Text, box, 0, 'tx'))).toBe('auto-height');
  });

  it('a clicked text grows with its line', () => {
    expect(sizingOf(drawClip(newMotionDoc(MotionFormat.Landscape), DrawTool.Text, box, 0, 'tx', TextSizing.AutoWidth))).toBe('auto');
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
});
