import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc } from '@feega/motion-core/motion/doc';
import { outlineTexts } from './text-outline-run';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { lettering } from './fixtures/lettering';

const must = (r: OpResult) => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const titled = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Title', from: 0, durationInFrames: 30, props: { text: 'Hi' } }, 'a'));
const doc = must(addClip(titled, { component: 'Text', from: 0, durationInFrames: 30, props: { text: 'there' } }, 'b'));

describe('outline texts', () => {
  it('loads the fonts of the video once and outlines every clip', async () => {
    const asked: unknown[] = [];
    const result = await outlineTexts(doc, ['a', 'b'], async (d) => (asked.push(d), lettering));

    expect(result.ok && ['a', 'b'].map((id) => findClip(result.doc, id)!.clip.component)).toEqual(['Shape', 'Shape']);
    expect(asked).toEqual([doc]);
  });

  it('says so when the font cannot be loaded', async () => {
    const result = await outlineTexts(doc, ['a'], async () => ({ ...lettering, fonts: () => null }));

    expect(result.ok).toBe(false);
  });
});
