import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { setTextCounter } from '../text-counter-ops';
import { composeHtml } from '@feega/motion-core/motion/hyperframes/compose';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const counting = (doc: MotionDoc) => must(setTextCounter(doc, 'n', { from: 0, to: 1200, start: 0, duration: 60 }));
const plain = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 120, props: { text: 'old' } }, 'n'));
const compose = (doc: MotionDoc) => composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {} });

describe('counter in the HyperFrames export', () => {
  it('starts on the from value and drives the text per frame', () => {
    const html = compose(counting(plain));

    expect(html).toContain('>0<');
    expect(html).not.toContain('>old<');
    expect(html).toContain('function countersAt(time)');
  });

  it('adds no script to a doc without counters', () => {
    expect(compose(plain)).not.toContain('countersAt');
  });
});
