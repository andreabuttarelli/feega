import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { pivotBox } from '@feega/motion-core/motion/parent';
import { withAutoLayout } from '@feega/motion-core/motion/layout/resolve';
import { setAutoLayout, wrapInStack } from './ops';
import { freeStackFit } from './stack-fit';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const element = (() => {
  const doc = { ...newMotionDoc(MotionFormat.Landscape), width: 400, height: 100 };
  const texted = must(addClip(doc, { component: 'Text', from: 0, props: { text: 'Hello', x: 0.25, y: 0.5, width: 0.5, height: 1 } }, 'k'));
  const boxed = must(addClip(texted, { component: 'Shape', from: 0, props: { shape: 'rect', x: 0.75, y: 0.5, width: 0.1, height: 0.4, strokes: [{ paint: { type: 'solid', color: '#000000' }, width: 0.02 }] } }, 'sq'));
  return must(wrapInStack(boxed, ['k', 'sq'], 'stack', 'lane'));
})();

const pxBox = (doc: MotionDoc, id: string) => pivotBox(findClip(withAutoLayout(doc), id)!.clip.props, { width: doc.width, height: doc.height });

describe('a free stack element follows its stack', () => {
  const padded = must(setAutoLayout(freeStackFit(element)?.doc ?? element, 'stack', { padding: { top: 20, right: 30, bottom: 20, left: 30 } }));
  const fit = freeStackFit(padded)!;

  it('grows the stage to the box the stack hugs', () => {
    const stack = pxBox(fit.doc, 'stack');
    expect(stack.left).toBeCloseTo(0, 0);
    expect(stack.width).toBeCloseTo(fit.doc.width, 0);
    expect(stack.height).toBeCloseTo(fit.doc.height, 0);
    expect(fit.share.width).toBeCloseTo(fit.doc.width / padded.width, 5);
  });

  it('keeps every child the size it was in pixels', () => {
    for (const id of ['k', 'sq']) {
      const was = pxBox(padded, id);
      const now = pxBox(fit.doc, id);
      expect(now.width).toBeCloseTo(was.width, 0);
      expect(now.height).toBeCloseTo(was.height, 0);
    }
  });

  it('keeps strokes the same width in pixels', () => {
    const unit = (doc: MotionDoc) => Math.min(doc.width, doc.height);
    const stroke = (doc: MotionDoc) => (findClip(doc, 'sq')!.clip.props.strokes as { width: number }[])[0].width * unit(doc);
    expect(stroke(fit.doc)).toBeCloseTo(stroke(padded), 5);
  });

  it('is settled once the stage matches', () => {
    expect(freeStackFit(fit.doc)).toBeNull();
  });

  it('leaves an element that is not one stack alone', () => {
    expect(freeStackFit(must(addClip(fit.doc, { component: 'Shape', from: 0, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.1, height: 0.1 } }, 'loose')))).toBeNull();
  });
});

describe('a free stack hugs the text it measures', () => {
  it('sizes the stage from the measure the renderer shapes with', () => {
    const lone = must(wrapInStack(must(addClip({ ...newMotionDoc(MotionFormat.Landscape), width: 400, height: 100 }, { component: 'Text', from: 0, props: { text: 'Get started', sizing: 'auto', x: 0.25, y: 0.25, width: 0.5, height: 0.5 } }, 't')), ['t'], 'stack', 'lane'));
    const shaped = { width: 321, height: 40 };

    const fit = freeStackFit(lone, () => shaped)!;

    expect(fit.doc.width).toBe(shaped.width);
    expect(fit.doc.height).toBe(shaped.height);
  });
});
