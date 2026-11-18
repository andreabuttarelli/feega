import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc } from '../doc';
import { addClip } from '../timeline';
import { preparedDoc } from './compose';

function doc() {
  const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'hello' } }, 'a');
  if (!added.ok) {
    throw new Error(added.error);
  }
  return added.doc;
}

describe('preparing a doc for drawing', () => {
  it('prepares a doc once however many readers ask for it', () => {
    const raw = { doc: doc(), tokens: FEEGA_TOKENS, assets: {} };

    expect(preparedDoc({ ...raw })).toBe(preparedDoc({ ...raw }));
  });

  it('prepares again when the doc changes', () => {
    const first = doc();
    const second = { ...first, tracks: [...first.tracks] };

    expect(preparedDoc({ doc: first, tokens: FEEGA_TOKENS, assets: {} })).not.toBe(preparedDoc({ doc: second, tokens: FEEGA_TOKENS, assets: {} }));
  });
});
