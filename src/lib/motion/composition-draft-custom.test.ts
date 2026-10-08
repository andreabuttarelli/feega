import { describe, expect, it } from 'vitest';
import { applyDraft, draftFromDoc, newDraft, withCustomLayout, withLayout } from './composition-draft';
import { MotionFormat, newMotionDoc } from './doc';

const ORBIT = { id: 'lay-1', name: 'orbit', spec: { kind: 'spec' as const, slots: 6, place: { kind: 'ring' as const, radius: 3 } } };

describe('a compose draft on a custom layout', () => {
  it('selects the custom layout and round-trips it through the doc', () => {
    const draft = withCustomLayout({ ...newDraft('coverflow'), media: [{ assetId: 'a1', kind: 'image' }] }, ORBIT);
    const verdict = applyDraft(newMotionDoc(MotionFormat.Vertical), draft);

    expect(verdict.ok).toBe(true);
    const back = verdict.ok ? draftFromDoc(verdict.doc) : null;
    expect(back).toMatchObject({ layout: 'custom', custom: ORBIT });
  });

  it('a built-in layout drops the custom one', () => {
    const draft = withLayout(withCustomLayout(newDraft('coverflow'), ORBIT), 'helix');

    expect(draft.custom).toBeNull();
  });
});
