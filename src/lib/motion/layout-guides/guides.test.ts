import { describe, expect, it } from 'vitest';
import { GuideAlign, GuideKind, guideBands, guideLines, guideSnapBounds, newGuide, setLayoutGuides } from './guides';
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

  it('the lines of a grid are snap targets', () => {
    const doc = setLayoutGuides({ ...newMotionDoc(MotionFormat.Landscape), width: 300, height: 200 }, [{ ...newGuide(GuideKind.Grid), size: 100 }]);

    expect(doc.ok && guideSnapBounds(doc.doc)).toEqual([
      { left: 100, top: 0, right: 100, bottom: 200 },
      { left: 200, top: 0, right: 200, bottom: 200 },
      { left: 0, top: 100, right: 300, bottom: 100 }
    ]);
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

describe.each([GuideKind.Columns, GuideKind.Rows])('%s stay inside the frame', (kind) => {
  const span = kind === GuideKind.Columns ? FRAME.width : FRAME.height;
  const edges = (b: { left: number; top: number; width: number; height: number }) => (kind === GuideKind.Columns ? [b.left, b.left + b.width] : [b.top, b.top + b.height]);

  it.each([GuideAlign.Stretch, GuideAlign.Center])('%s: equal margins on both sides', (align) => {
    const guide = { ...newGuide(kind), align, count: 4, gutter: 20, margin: 30, size: 100 };
    const bands = guideBands(guide, FRAME).map(edges);

    expect(bands[0][0]).toBeCloseTo(span - bands[bands.length - 1][1]);
    expect(bands[0][0]).toBeGreaterThanOrEqual(0);
  });

  it.each([GuideAlign.Stretch, GuideAlign.Min, GuideAlign.Max, GuideAlign.Center])('%s with auto count never leaves the frame', (align) => {
    const guide = { ...newGuide(kind), align, count: 'auto' as const, gutter: 20, margin: 30, size: 110, offset: 70 };
    const bands = guideBands(guide, FRAME).map(edges);

    expect(Math.min(...bands.map((b) => b[0]))).toBeGreaterThanOrEqual(0);
    expect(Math.max(...bands.map((b) => b[1]))).toBeLessThanOrEqual(span);
  });

  it.each([GuideAlign.Min, GuideAlign.Max, GuideAlign.Center])('%s with a fixed count too wide for the frame keeps only what fits', (align) => {
    const guide = { ...newGuide(kind), align, count: 12, gutter: 20, size: 200, offset: 0 };
    const bands = guideBands(guide, FRAME).map(edges);

    expect(Math.min(...bands.map((b) => b[0]))).toBeGreaterThanOrEqual(0);
    expect(Math.max(...bands.map((b) => b[1]))).toBeLessThanOrEqual(span);
  });
});

describe('layout guide count and alignment', () => {
  const columns = (change: object) => ({ ...newGuide(GuideKind.Columns), ...change });

  it('an auto count fits as many sections of the size as the frame holds', () => {
    const bands = guideBands(columns({ count: 'auto', size: 100, gutter: 0, margin: 0, align: GuideAlign.Min }), FRAME);

    expect(bands).toHaveLength(10);
    expect(bands.every((b) => b.width === 100)).toBe(true);
  });

  it('an auto count leaves out a section that would not fit between the margins', () => {
    expect(guideBands(columns({ count: 'auto', size: 100, gutter: 20, margin: 50 }), FRAME)).toHaveLength(7);
  });

  it('an auto stretch count shares the width between the margins', () => {
    const bands = guideBands(columns({ count: 'auto', size: 100, gutter: 0, margin: 0 }), FRAME);

    expect(bands.map((b) => b.width)).toEqual(Array.from({ length: 10 }, () => 100));
  });

  it('center puts the columns in the middle of the frame', () => {
    const bands = guideBands(columns({ align: GuideAlign.Center, count: 3, size: 100, gutter: 50 }), FRAME);

    expect(bands.map((b) => b.left)).toEqual([300, 450, 600]);
  });

  it('min starts the columns at the offset', () => {
    const bands = guideBands(columns({ align: GuideAlign.Min, count: 2, size: 100, gutter: 0, offset: 30 }), FRAME);

    expect(bands.map((b) => b.left)).toEqual([30, 130]);
  });

  it('max ends the columns at the offset from the far edge', () => {
    const bands = guideBands(columns({ align: GuideAlign.Max, count: 2, size: 100, gutter: 0, offset: 30 }), FRAME);

    expect(bands.map((b) => b.left)).toEqual([770, 870]);
  });

  it('rows align down the height', () => {
    const bands = guideBands({ ...newGuide(GuideKind.Rows), align: GuideAlign.Max, count: 1, size: 50, offset: 10 }, FRAME);

    expect(bands.map((b) => [b.top, b.height])).toEqual([[440, 50]]);
  });

  it('a new guide is red at ten percent', () => {
    expect(newGuide(GuideKind.Columns)).toMatchObject({ color: '#ff0000', opacity: 0.1, align: GuideAlign.Stretch });
  });

  it('a hidden guide still snaps', () => {
    const doc = setLayoutGuides({ ...newMotionDoc(MotionFormat.Landscape), width: 1000, height: 500 }, [{ ...newGuide(GuideKind.Columns), count: 2, gutter: 0, margin: 0, hidden: true }]);

    expect(doc.ok && guideSnapBounds(doc.doc)).toHaveLength(2);
  });
});
