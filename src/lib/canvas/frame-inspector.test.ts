import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { Action } from '$lib/motion/actions';
import { PropertiesView } from '$lib/motion/properties-view';
import { addClip, type OpResult } from '$lib/motion/timeline';
import { barAction, inspectorOf } from './frame-inspector';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

function fixture(): MotionDoc {
  let d = newMotionDoc(MotionFormat.Square);
  d = must(addClip(d, { component: 'Title', from: 0, durationInFrames: 30, props: { text: 'One' } }, 'a'));
  return must(addClip(d, { component: 'Title', from: 0, durationInFrames: 30, props: { text: 'Two' } }, 'b'));
}

describe('inspectorOf', () => {
  it('shows nothing for an empty selection', () => {
    expect(inspectorOf(fixture(), [])).toBeNull();
  });

  it('shows the clip inspector for one element', () => {
    const shown = inspectorOf(fixture(), ['a']);

    expect(shown?.view).toBe(PropertiesView.Clip);
    expect(shown?.clip?.id).toBe('a');
  });

  it('shows the multi inspector for several', () => {
    expect(inspectorOf(fixture(), ['a', 'b'])?.view).toBe(PropertiesView.Multiple);
  });

  it('shows nothing for an id the doc no longer has', () => {
    expect(inspectorOf(fixture(), ['gone'])).toBeNull();
  });
});

describe('barAction', () => {
  const ids = () => 'new1';

  it('deletes the selected clip', () => {
    const done = barAction(Action.Delete, { doc: fixture(), selection: ['a'], frame: 0, newId: ids });

    expect(done?.doc.tracks.flatMap((t) => t.clips).map((c) => c.id)).toEqual(['b']);
  });

  it('duplicates the selected clip', () => {
    const done = barAction(Action.Duplicate, { doc: fixture(), selection: ['a'], frame: 0, newId: ids });

    expect(done?.doc.tracks.flatMap((t) => t.clips)).toHaveLength(3);
  });

  it('ignores actions the canvas panel does not run', () => {
    expect(barAction(Action.OpenComp, { doc: fixture(), selection: ['a'], frame: 0, newId: ids })).toBeNull();
  });
});
