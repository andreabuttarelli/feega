import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { addClip, type OpResult } from './timeline';
import { precompose } from './precomp';
import { Action } from './actions';
import { clipActions, parentChoices } from './clip-bar';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

function fixture(): MotionDoc {
  let d = newMotionDoc(MotionFormat.Square);
  d = must(addClip(d, { component: 'Title', from: 0, durationInFrames: 30, props: { text: 'One' } }, 'a'));
  d = must(addClip(d, { component: 'Title', from: 10, durationInFrames: 20, props: { text: 'Two' } }, 'b'));
  return d;
}

describe('clip bar', () => {
  it('offers split, duplicate, delete, parent, select several and properties for a clip', () => {
    expect(clipActions(fixture(), ['a'])).toEqual([Action.Split, Action.Duplicate, Action.Delete, Action.ParentTo, Action.SelectSeveral, Action.ClipProperties]);
  });

  it('adds Open for a single precomp, the touch path to what a double click does', () => {
    const doc = must(precompose(fixture(), ['a'], { comp: 'c1', clip: 'p' }, 'Comp 1'));

    expect(clipActions(doc, ['p'])).toContain(Action.OpenComp);
    expect(clipActions(doc, ['p', 'b'])).not.toContain(Action.OpenComp);
  });

  it('shows nothing without a selection', () => {
    expect(clipActions(fixture(), [])).toEqual([]);
  });

  it('lets a clip be parented to any other layer, or to none', () => {
    const choices = parentChoices(fixture(), ['b']);

    expect(choices.map((c) => c.id)).toEqual([null, 'a']);
    expect(choices[1].name).toBe('One');
  });
});
