import { describe, expect, it } from 'vitest';
import { outlineStroke, outlineStrokes } from './outline-stroke';
import { polygonArea } from './boolean';
import { MotionFormat, clipsOf, findClip, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, type OpResult } from '../timeline';
import { flatten, parsePath } from './geometry';

const ok = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const RED = { type: 'solid', color: '#ff0000' };
const stroke = (align = 'center') => [{ paint: RED, width: 0.01, align }];
const square = (props: Record<string, unknown>) => ({ component: 'Shape' as const, from: 0, durationInFrames: 60, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.2, height: 0.2 * (16 / 9), ...props } });

function area(doc: MotionDoc, id: string): number {
  const outline = parsePath(String(findClip(doc, id)!.clip.props.path));
  if (typeof outline === 'string') {
    throw new Error(outline);
  }
  const [outer, ...holes] = outline.map((c) => polygonArea(flatten(c))).sort((a, b) => b - a);
  return holes.reduce((left, hole) => left - hole, outer);
}

const ids = () => {
  let n = 0;
  return () => `new${++n}`;
};

describe('outline stroke', () => {
  it('a stroke-only shape becomes the filled ring its stroke drew', () => {
    const doc = ok(addClip(newMotionDoc(MotionFormat.Landscape), square({ fills: [], strokes: stroke() }), 'box'));

    const out = ok(outlineStroke(doc, 'box', 0, ids()));
    const props = findClip(out, 'box')!.clip.props;

    expect(props).toMatchObject({ shape: 'path', strokes: [], fills: [RED] });
    expect(area(out, 'box')).toBeCloseTo((4 * 384 * 10.8) / 384 ** 2, 2);
  });

  it('an inside stroke stays within the outline', () => {
    const doc = ok(addClip(newMotionDoc(MotionFormat.Landscape), square({ fills: [], strokes: stroke('inside') }), 'box'));

    expect(area(ok(outlineStroke(doc, 'box', 0, ids())), 'box')).toBeCloseTo((384 ** 2 - (384 - 21.6) ** 2) / 384 ** 2, 2);
  });

  it('a filled shape keeps its fill and gets the stroke as a new layer above it', () => {
    const doc = ok(addClip(newMotionDoc(MotionFormat.Landscape), square({ fills: [{ type: 'solid', color: '#0000ff' }], strokes: stroke() }), 'box'));

    const out = ok(outlineStroke(doc, 'box', 0, ids()));

    expect(findClip(out, 'box')!.clip.props).toMatchObject({ shape: 'rect', strokes: [] });
    expect(findClip(out, 'new2')!.clip.props).toMatchObject({ shape: 'path', fills: [RED] });
    expect(out.tracks.findIndex((t) => t.clips.some((c) => c.id === 'new2'))).toBeLessThan(out.tracks.findIndex((t) => t.clips.some((c) => c.id === 'box')));
    expect(clipsOf(out)).toHaveLength(2);
  });

  it('outlines every selected shape', () => {
    const one = ok(addClip(newMotionDoc(MotionFormat.Landscape), square({ fills: [], strokes: stroke() }), 'a'));
    const both = ok(addClip(one, { ...square({ fills: [], strokes: stroke() }), from: 60 }, 'b'));

    const out = ok(outlineStrokes(both, ['a', 'b'], 0, ids()));

    expect(['a', 'b'].map((id) => findClip(out, id)!.clip.props.shape)).toEqual(['path', 'path']);
  });

  it('refuses a shape without a stroke', () => {
    const doc = ok(addClip(newMotionDoc(MotionFormat.Landscape), square({ strokes: [] }), 'box'));
    expect(outlineStroke(doc, 'box', 0, ids()).ok).toBe(false);
  });
});
