import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from './doc';
import { setStill } from './still';
import { DrawTool } from './draw-tool';
import { drawClip, penClip } from './draw-create';
import { parsePath } from './shape/geometry';
import type { OpResult } from './timeline';

const ok = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const video = () => ({ ...newMotionDoc(MotionFormat.Landscape), durationInFrames: 300 });
const still = () => ok(setStill(video(), 0));
const BOX = { x: 0.4, y: 0.3, width: 0.2, height: 0.1 };

describe('creating an element by drawing inside a frame', () => {
  it('a rectangle is a rect Shape clip on the drawn box', () => {
    const clip = findClip(ok(drawClip(video(), DrawTool.Rectangle, BOX, 0, 'r1')), 'r1')!.clip;

    expect(clip.component).toBe('Shape');
    expect(clip.props).toMatchObject({ shape: 'rect', ...BOX });
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
