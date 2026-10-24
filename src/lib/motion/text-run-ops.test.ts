import { describe, expect, it } from 'vitest';
import { findClip, MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { addClip } from './timeline';
import { RunToggle } from './text-runs';
import type { ComponentId } from './components';
import { clearTextRuns, listTextRange, styleTextRange } from './text-run-ops';
import { ListChange } from './text-lists';

function withText(component: ComponentId = 'Text'): MotionDoc {
  const added = addClip(newMotionDoc(MotionFormat.Landscape), { component, from: 0, durationInFrames: 90, props: { text: 'Hello world' } }, 't');
  if (!added.ok) {
    throw new Error(added.error);
  }
  return added.doc;
}

const runsOf = (doc: MotionDoc) => findClip(doc, 't')!.clip.props.runs;

describe('styling a range of a text clip', () => {
  it('stores the run on the clip', () => {
    const result = styleTextRange(withText(), 't', { start: 6, end: 11 }, { weight: RunToggle.Bold, color: '#ff0000' });
    expect(result.ok && runsOf(result.doc)).toEqual([{ start: 6, end: 11, color: '#ff0000', weight: 700 }]);
  });

  it('refuses a range outside the text', () => {
    expect(styleTextRange(withText(), 't', { start: 6, end: 40 }, { italic: true }).ok).toBe(false);
  });

  it('refuses a text kind that has no styled ranges', () => {
    expect(styleTextRange(withText('Kicker'), 't', { start: 0, end: 2 }, { italic: true }).ok).toBe(false);
  });

  it('clearing drops every run', () => {
    const styled = styleTextRange(withText(), 't', { start: 0, end: 5 }, { italic: true });
    const cleared = styled.ok ? clearTextRuns(styled.doc, 't') : styled;
    expect(cleared.ok && runsOf(cleared.doc)).toBeUndefined();
  });
});

describe('listing the paragraphs of a text clip', () => {
  const listsOf = (doc: MotionDoc) => findClip(doc, 't')!.clip.props.lists;
  const two = (): MotionDoc => {
    const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 90, props: { text: 'one\ntwo' } }, 't');
    if (!added.ok) {
      throw new Error(added.error);
    }
    return added.doc;
  };

  it('makes the paragraphs a range touches a numbered list', () => {
    const result = listTextRange(two(), 't', { start: 0, end: 7 }, ListChange.Number);

    expect(result.ok && listsOf(result.doc)).toEqual([
      { kind: 'number', level: 0 },
      { kind: 'number', level: 0 }
    ]);
  });

  it('nests and lifts an item, and none takes the list away', () => {
    const listed = listTextRange(two(), 't', { start: 4, end: 5 }, ListChange.Bullet);
    const nested = listed.ok ? listTextRange(listed.doc, 't', { start: 4, end: 5 }, ListChange.Nest) : listed;

    expect(nested.ok && listsOf(nested.doc)).toEqual([null, { kind: 'bullet', level: 1 }]);
    const gone = nested.ok ? listTextRange(nested.doc, 't', { start: 0, end: 7 }, ListChange.None) : nested;
    expect(gone.ok && listsOf(gone.doc)).toBeUndefined();
  });

  it('refuses a text kind that has no lists', () => {
    expect(listTextRange(withText('Kicker'), 't', { start: 0, end: 2 }, ListChange.Bullet).ok).toBe(false);
  });
});
