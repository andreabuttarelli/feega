import { describe, expect, it } from 'vitest';
import { findClip, MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { addClip } from './timeline';
import { RunToggle } from './text-runs';
import type { ComponentId } from './components';
import { clearTextRuns, styleTextRange } from './text-run-ops';

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
