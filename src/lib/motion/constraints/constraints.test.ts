import { describe, expect, it } from 'vitest';
import { Horizontal, Vertical, resizeFrame, setConstraints } from './constraints';
import { MotionFormat, findClip, newMotionDoc, parseMotionDoc, type MotionDoc } from '../doc';
import { addClip, type OpResult } from '../timeline';
import { pivotBox } from '../parent';

const ok = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const card = { component: 'Shape' as const, from: 0, durationInFrames: 30, props: { shape: 'rect', x: 0.1, y: 0.9, width: 0.1, height: 0.1 } };

function framed(horizontal: Horizontal, vertical: Vertical): MotionDoc {
  const doc = ok(addClip({ ...newMotionDoc(MotionFormat.Custom), width: 1000, height: 1000, freeSize: true }, card, 'card'));
  return ok(setConstraints(doc, ['card'], { horizontal, vertical }));
}

const boxAfter = (doc: MotionDoc, size: { width: number; height: number }) => {
  const resized = ok(resizeFrame(doc, size));
  return pivotBox(findClip(resized, 'card')!.clip.props, resized);
};

describe('constraints', () => {
  it('left and bottom keep the distance to those edges and the size in pixels', () => {
    expect(boxAfter(framed(Horizontal.Left, Vertical.Bottom), { width: 1200, height: 800 })).toEqual({ left: 50, top: 650, width: 100, height: 100 });
  });

  it('right keeps the distance to the right edge', () => {
    const box = boxAfter(framed(Horizontal.Right, Vertical.Top), { width: 1200, height: 1000 });

    expect([box.left + box.width, box.width]).toEqual([350, 100]);
  });

  it('left and right stretch the layer with the frame', () => {
    const box = boxAfter(framed(Horizontal.LeftRight, Vertical.Top), { width: 1200, height: 1000 });

    expect([box.left, box.width]).toEqual([50, 300]);
  });

  it('centre keeps the offset from the middle', () => {
    const box = boxAfter(framed(Horizontal.Center, Vertical.Center), { width: 1200, height: 1200 });

    expect([box.left, box.top]).toEqual([150, 950]);
  });

  it('scale, the default, keeps the proportions', () => {
    const doc = ok(addClip({ ...newMotionDoc(MotionFormat.Custom), width: 1000, height: 1000, freeSize: true }, card, 'card'));

    expect(boxAfter(doc, { width: 1600, height: 1000 })).toEqual({ left: 80, top: 850, width: 160, height: 100 });
  });

  it('constraints are saved with the clip', () => {
    const doc = framed(Horizontal.Right, Vertical.Bottom);
    const parsed = parseMotionDoc(JSON.parse(JSON.stringify(doc)));

    expect(parsed.ok && findClip(parsed.doc, 'card')!.clip.constraints).toEqual({ horizontal: Horizontal.Right, vertical: Vertical.Bottom });
  });
});
