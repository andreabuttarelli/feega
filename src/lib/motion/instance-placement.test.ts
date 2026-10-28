// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, setTransform, type OpResult } from '@feega/motion-core/motion/timeline';
import { composeHtml } from '@feega/motion-core/motion/hyperframes/compose';
import { createComponent } from './main-component';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

let n = 0;
const newId = () => `id${++n}`;

function movedInstance(): { doc: MotionDoc; host: string } {
  const drawn = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 90, props: { shape: 'rect' } }, 'bg'));
  const doc = must(createComponent(drawn, ['bg'], newId, 'Button'));
  const host = doc.tracks.flatMap((t) => t.clips).find((c) => c.component === 'Precomp')!.id;
  return { doc: must(setTransform(doc, host, { x: 0.2, y: 0.1 })), host };
}

describe('an instance moved on the canvas', () => {
  it('moves its content once, not once for the group and again for each element', () => {
    const { doc, host } = movedInstance();

    const html = composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {}, origin: 'https://app.test' });

    expect(html).toContain(`id="kf-${host}"`);
    expect(html).not.toContain(`class="kf kc-${host}`);
  });
});
