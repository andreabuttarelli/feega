import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, type OpResult } from '../timeline';
import { Direction } from './auto-layout';
import { StripKind, dragStrip, layoutStrips, reorderAt } from './guides';
import { DEFAULT_AUTO_LAYOUT } from './model';
import { setAutoLayout, wrapInAutoLayout } from './ops';

function must(r: OpResult | null): MotionDoc {
  if (!r?.ok) {
    throw new Error(r ? r.error : 'no result');
  }
  return r.doc;
}

const row = (() => {
  let doc = { ...newMotionDoc(MotionFormat.Square), width: 1000, height: 1000 };
  for (const [id, x] of [['a', 0.2], ['b', 0.5], ['c', 0.8]] as const) {
    doc = must(addClip(doc, { component: 'Shape', from: 0, props: { shape: 'rect', x, y: 0.5, width: 0.1, height: 0.1 } }, id));
  }
  doc = must(wrapInAutoLayout(doc, ['a', 'b', 'c'], 'box', 'lane'));
  return must(setAutoLayout(doc, 'box', { gap: 20, padding: { top: 10, right: 10, bottom: 10, left: 10 } }));
})();

describe('layoutStrips', () => {
  const strips = layoutStrips(row, 'box');

  it('draws the four padding sides of the container', () => {
    const top = strips.find((s) => s.kind === StripKind.Padding && s.side === 'top')!;
    expect(top.box).toEqual({ left: 150, top: 450, width: 360, height: 10 });
  });

  it('draws one gap between each pair of neighbours', () => {
    const gaps = strips.filter((s) => s.kind === StripKind.Gap);
    expect(gaps.map((g) => g.box)).toEqual([
      { left: 260, width: 20, top: 460, height: 100 },
      { left: 380, width: 20, top: 460, height: 100 }
    ]);
  });

  it('is empty for a clip that is not a container', () => {
    expect(layoutStrips(row, 'a')).toEqual([]);
  });
});

describe('dragStrip', () => {
  const layout = { ...DEFAULT_AUTO_LAYOUT, gap: 20, padding: { top: 10, right: 10, bottom: 10, left: 10 } };

  it('a gap follows the drag along the main axis, never below zero', () => {
    expect(dragStrip(layout, { kind: StripKind.Gap, box: { left: 0, top: 0, width: 0, height: 0 } }, [7, 99])).toEqual({ gap: 27 });
    expect(dragStrip({ ...layout, direction: Direction.Vertical }, { kind: StripKind.Gap, box: { left: 0, top: 0, width: 0, height: 0 } }, [7, -99])).toEqual({ gap: 0 });
  });

  it('a padding side grows when dragged inward', () => {
    const strip = (side: 'top' | 'right' | 'bottom' | 'left') => ({ kind: StripKind.Padding as const, side, box: { left: 0, top: 0, width: 0, height: 0 } });
    expect(dragStrip(layout, strip('top'), [0, 5]).padding).toMatchObject({ top: 15 });
    expect(dragStrip(layout, strip('right'), [5, 0]).padding).toMatchObject({ right: 5 });
  });
});

describe('reorderAt', () => {
  it('drops a child at the slot under the pointer', () => {
    const doc = must(reorderAt(row, 'a', [390, 500]));
    expect(findClip(doc, 'box')!.clip.autoLayout!.order).toEqual(['b', 'a', 'c']);
    expect(findClip(must(reorderAt(row, 'a', [999, 500])), 'box')!.clip.autoLayout!.order).toEqual(['b', 'c', 'a']);
  });

  it('is null for a clip that is not in an auto layout', () => {
    expect(reorderAt(row, 'box', [0, 0])).toBeNull();
  });
});
