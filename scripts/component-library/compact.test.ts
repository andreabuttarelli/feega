import { describe, expect, it } from 'vitest';
import { newMotionDoc, MotionFormat, parseMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { compacted } from './compact';

const sample = (): MotionDoc => {
  const doc = newMotionDoc(MotionFormat.Landscape);
  const added = addClip(doc, { component: 'Text', from: 0, durationInFrames: 30, props: { text: 'Start free trial', color: '#ffffff', x: 0.2 } }, 'c1');
  if (!added.ok) {
    throw new Error(added.error);
  }
  return added.doc;
};

describe('a compacted Arc doc', () => {
  it('parses back to the doc it came from', () => {
    const doc = parseMotionDoc(sample());
    if (!doc.ok) {
      throw new Error(doc.error);
    }
    const back = parseMotionDoc(compacted(doc.doc));
    expect(back.ok && back.doc).toEqual(doc.doc);
  });

  it('is smaller than the doc it came from', () => {
    const doc = sample();
    expect(JSON.stringify(compacted(doc)).length).toBeLessThan(JSON.stringify(doc).length / 2);
  });
});
