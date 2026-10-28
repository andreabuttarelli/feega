import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, parseMotionDoc } from '@feega/motion-core/motion/doc';
import { GuideAxis } from '@feega/motion-core/motion/user-guides/model';
import { guideSnapBounds } from '$lib/motion/layout-guides/guides';
import { DropOutcome, addGuide, dropOutcome, moveGuide, removeGuide, rulerTicks, tickStep } from './user-guides';

const doc = { ...newMotionDoc(MotionFormat.Landscape), width: 400, height: 300 };

describe('user guides', () => {
  it('adds a guide on an axis', () => {
    const next = addGuide(doc, { axis: GuideAxis.Vertical, at: 120 });

    expect(next.ok && next.doc.userGuides).toEqual([{ axis: 'x', at: 120 }]);
  });

  it('rounds the position to a whole pixel', () => {
    const next = addGuide(doc, { axis: GuideAxis.Horizontal, at: 10.6 });

    expect(next.ok && next.doc.userGuides).toEqual([{ axis: 'y', at: 11 }]);
  });

  it('the same guide twice stays one', () => {
    const once = addGuide(doc, { axis: GuideAxis.Vertical, at: 50 });
    const twice = once.ok ? addGuide(once.doc, { axis: GuideAxis.Vertical, at: 50 }) : once;

    expect(twice.ok && twice.doc.userGuides).toHaveLength(1);
  });

  it('refuses a position outside the frame', () => {
    expect(addGuide(doc, { axis: GuideAxis.Vertical, at: 401 }).ok).toBe(false);
    expect(addGuide(doc, { axis: GuideAxis.Horizontal, at: -1 }).ok).toBe(false);
  });

  it('removes a guide, and the field with the last one', () => {
    const once = addGuide(doc, { axis: GuideAxis.Vertical, at: 50 });
    const gone = once.ok ? removeGuide(once.doc, { axis: GuideAxis.Vertical, at: 50 }) : once;

    expect(gone.ok && gone.doc.userGuides).toBeUndefined();
  });

  it('removing a guide that is not there is an error', () => {
    expect(removeGuide(doc, { axis: GuideAxis.Vertical, at: 50 }).ok).toBe(false);
  });

  it('moves a guide', () => {
    const once = addGuide(doc, { axis: GuideAxis.Vertical, at: 50 });
    const moved = once.ok ? moveGuide(once.doc, { axis: GuideAxis.Vertical, at: 50 }, 80) : once;

    expect(moved.ok && moved.doc.userGuides).toEqual([{ axis: 'x', at: 80 }]);
  });

  it('is saved with the frame', () => {
    const next = addGuide(doc, { axis: GuideAxis.Horizontal, at: 100 });

    expect(next.ok && parseMotionDoc(JSON.parse(JSON.stringify(next.doc)))).toMatchObject({ ok: true, doc: { userGuides: [{ axis: 'y', at: 100 }] } });
  });

  it('is a snap target for layers', () => {
    const next = addGuide(doc, { axis: GuideAxis.Vertical, at: 120 });

    expect(next.ok && guideSnapBounds(next.doc)).toEqual([{ left: 120, top: 0, right: 120, bottom: 300 }]);
  });
});

describe('dropping a guide', () => {
  const frame = { width: 400, height: 300 };

  it('inside the frame keeps it', () => {
    expect(dropOutcome(frame, { axis: GuideAxis.Vertical, at: 200 })).toBe(DropOutcome.Keep);
  });

  it('back on the ruler or beyond the frame deletes it', () => {
    expect(dropOutcome(frame, { axis: GuideAxis.Vertical, at: -3 })).toBe(DropOutcome.Delete);
    expect(dropOutcome(frame, { axis: GuideAxis.Horizontal, at: 301 })).toBe(DropOutcome.Delete);
  });
});

describe('ruler ticks', () => {
  it('the step grows as the zoom falls so labels never crowd', () => {
    expect(tickStep(1)).toBe(50);
    expect(tickStep(0.1)).toBe(500);
    expect(tickStep(4)).toBe(10);
  });

  it('marks every step along the span with its label', () => {
    expect(rulerTicks(120, 1)).toEqual([
      { at: 0, label: '0' },
      { at: 50, label: '50' },
      { at: 100, label: '100' }
    ]);
  });

  it('drops a tick whose label would run past the end of the ruler', () => {
    const ticks = rulerTicks(1000, 0.8, 36);

    expect(ticks.at(-1)?.at).toBe(950);
  });
});
