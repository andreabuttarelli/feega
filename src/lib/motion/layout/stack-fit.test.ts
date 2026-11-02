import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { pivotBox } from '@feega/motion-core/motion/parent';
import { withAutoLayout } from '@feega/motion-core/motion/layout/resolve';
import { duplicateLayer, setAutoLayout, wrapInStack } from './ops';
import { freeStackFit } from './stack-fit';
import { ResizeMode, fitToNode } from '../custom-size';
import { Sizing } from '@feega/motion-core/motion/layout/auto-layout';
import { setStill } from '@feega/motion-core/motion/still';

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

describe('resizing a free stack element on the canvas', () => {
  const hugging = freeStackFit(element)?.doc ?? element;
  const itemOf = (doc: MotionDoc) => findClip(doc, 'stack')!.clip.layoutItem!;

  it('a taller drag turns the hugged height Fixed at the dragged size, and the node box stays the stack box', () => {
    const sized = must(fitToNode(hugging, { width: hugging.width, height: hugging.height * 3 }, ResizeMode.Element));
    const stack = pxBox(sized, 'stack');

    expect(itemOf(sized).height).toBe(Sizing.Fixed);
    expect(itemOf(sized).width).toBe(Sizing.Hug);
    expect(stack.height).toBeCloseTo(sized.height, 0);
    expect(stack.width).toBeCloseTo(sized.width, 0);
    expect(pxBox(sized, 'sq').height).toBeCloseTo(pxBox(hugging, 'sq').height, 0);
    expect(freeStackFit(sized)).toBeNull();
  });

  it('a wider drag turns the hugged width Fixed and leaves the height hugging', () => {
    const sized = must(fitToNode(hugging, { width: hugging.width * 2, height: hugging.height }, ResizeMode.Element));

    expect(itemOf(sized).width).toBe(Sizing.Fixed);
    expect(itemOf(sized).height).toBe(Sizing.Hug);
    expect(pxBox(sized, 'stack').width).toBeCloseTo(sized.width, 0);
    expect(freeStackFit(sized)).toBeNull();
  });

  it('a stack drawn at two pixels per canvas unit keeps its children their size on the canvas', () => {
    const still = must(setStill(hugging, 0));
    const dense = { ...still, width: still.width * 2, height: still.height * 2 };
    const node = { width: hugging.width, height: hugging.height };
    const onCanvas = (doc: MotionDoc, size: { width: number }, id: string) => (pxBox(doc, id).width * size.width) / doc.width;

    const wider = { width: node.width + 100, height: node.height };
    const sized = must(fitToNode(dense, wider, ResizeMode.Element, node));

    expect(onCanvas(sized, wider, 'sq')).toBeCloseTo(onCanvas(dense, node, 'sq'), 0);
    expect(itemOf(sized).height).toBe(Sizing.Hug);
    expect(sized.width / sized.height).toBeCloseTo(wider.width / wider.height, 1);
  });

  it('a child added to a hugging stack grows the node to the stack box', () => {
    const grown = must(duplicateLayer(hugging, 'sq', 'more'));
    const fit = freeStackFit(grown)!;
    const stack = pxBox(fit.doc, 'stack');

    expect(fit.share.width).toBeGreaterThan(1);
    expect(stack.width).toBeCloseTo(fit.doc.width, 0);
    expect(stack.height).toBeCloseTo(fit.doc.height, 0);
  });
});
