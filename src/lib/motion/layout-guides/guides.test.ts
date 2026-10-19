import { describe, expect, it } from 'vitest';
import { GuideKind, guideBands, guideLines, guideSnapBounds, newGuide, setLayoutGuides } from './guides';
import { MotionFormat, newMotionDoc, parseMotionDoc } from '../doc';

const FRAME = { width: 1000, height: 500 };

describe('layout guides', () => {
  it('columns share the width left between the margins and the gutters', () => {
    const bands = guideBands({ ...newGuide(GuideKind.Columns), count: 4, gutter: 20, margin: 40 }, FRAME);

    expect(bands).toHaveLength(4);
    expect(bands[0]).toEqual({ left: 40, top: 0, width: 215, height: 500 });
    expect(bands[3].left + bands[3].width).toBe(960);
  });

  it('rows run down the height', () => {
    const bands = guideBands({ ...newGuide(GuideKind.Rows), count: 2, gutter: 10, margin: 0 }, FRAME);

    expect(bands.map((b) => [b.top, b.height])).toEqual([
      [0, 245],
      [255, 245]
    ]);
  });

  it('a grid is lines every size pixels, no bands', () => {
    const guide = { ...newGuide(GuideKind.Grid), size: 100 };

    expect(guideBands(guide, FRAME)).toEqual([]);
    expect(guideLines(guide, FRAME).filter((l) => l.axis === 'x')).toHaveLength(9);
    expect(guideLines(guide, FRAME).filter((l) => l.axis === 'y')).toHaveLength(4);
  });

  it('the band edges are snap targets', () => {
    const doc = setLayoutGuides({ ...newMotionDoc(MotionFormat.Landscape), width: 1000, height: 500 }, [{ ...newGuide(GuideKind.Columns), count: 2, gutter: 0, margin: 0 }]);

    expect(doc.ok && guideSnapBounds(doc.doc)).toEqual([
      { left: 0, top: 0, right: 500, bottom: 500 },
      { left: 500, top: 0, right: 1000, bottom: 500 }
    ]);
  });

  it('the guides are saved with the doc and survive a parse', () => {
    const set = setLayoutGuides(newMotionDoc(MotionFormat.Landscape), [newGuide(GuideKind.Columns)]);
    const parsed = set.ok ? parseMotionDoc(JSON.parse(JSON.stringify(set.doc))) : null;

    expect(parsed?.ok && parsed.doc.layoutGuides).toEqual([newGuide(GuideKind.Columns)]);
  });

  it('refuses more guides than the frame holds', () => {
    expect(setLayoutGuides(newMotionDoc(MotionFormat.Landscape), Array.from({ length: 20 }, () => newGuide(GuideKind.Rows))).ok).toBe(false);
  });
});
