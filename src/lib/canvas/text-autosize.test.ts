import { describe, expect, it } from 'vitest';
import { findClip, MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { FrameKind } from '$lib/canvas/motion-node';
import { applyTextFit, textAutosize } from './text-autosize';
import { setAutoLayout, wrapInStack } from '$lib/motion/layout/ops';

function texted(doc: MotionDoc, sizing: string): MotionDoc {
  const added = addClip(doc, { component: 'Text', from: 0, durationInFrames: 90, props: { text: 'Hello', sizing, x: 0.5, y: 0.5, width: 1, height: 1 } }, 't');
  if (!added.ok) {
    throw new Error(added.error);
  }
  return added.doc;
}

const element = (width: number, height: number): MotionDoc => ({ ...newMotionDoc(MotionFormat.Landscape), width, height });

describe('text boxes follow the laid text', () => {
  it('a free auto-width text resizes its node to the laid line', () => {
    const doc = texted(element(400, 100), 'auto');

    const fit = textAutosize(doc, { t: { left: 0, top: 0, width: 250, height: 60 } }, FrameKind.Element, { w: 400, h: 100 });

    expect(fit?.node).toEqual({ w: 250, h: 60 });
  });

  it('a free text that grows carries a doc sized to its node, so the canvas never draws the old picture stretched', () => {
    const doc = texted(element(400, 100), 'auto-height');
    const fit = textAutosize(doc, { t: { left: 0, top: 0, width: 400, height: 300 } }, FrameKind.Element, { w: 400, h: 100 });

    expect(fit?.node).toEqual({ w: 400, h: 300 });
    expect({ width: fit?.doc?.width, height: fit?.doc?.height }).toEqual({ width: 400, height: 300 });
    expect(findClip(fit!.doc!, 't')!.clip.props).toMatchObject({ x: 0.5, y: 0.5, width: 1, height: 1 });
  });

  it('a free fixed text keeps its node', () => {
    const doc = texted(element(400, 100), 'fixed');

    expect(textAutosize(doc, { t: { left: 0, top: 0, width: 250, height: 60 } }, FrameKind.Element, { w: 400, h: 100 })).toBeNull();
  });

  it('an auto-height text inside a frame stores the laid height', () => {
    const doc = texted(newMotionDoc(MotionFormat.Landscape), 'auto-height');
    const fit = textAutosize(doc, { t: { left: 0, top: 0, width: doc.width, height: doc.height / 2 } }, FrameKind.Frame, { w: 1, h: 1 });

    expect(findClip(fit!.doc!, 't')!.clip.props.height).toBeCloseTo(0.5);
  });
});

describe('a fitted text reaches the canvas whole', () => {
  it('the new box lands in the same step as the new doc, or the canvas stretches one over the other', () => {
    const steps: string[] = [];
    const doc = element(268, 204);
    applyTextFit({ doc, node: { w: 134, h: 102 } }, { amend: () => steps.push('amend'), show: () => steps.push('show'), place: () => steps.push('place') });
    expect(steps).toEqual(['amend', 'show', 'place']);
  });
});

describe('a free stack follows the box it hugs', () => {
  it('resizes its node and its stage when the padding grows', () => {
    const boxed = addClip(element(400, 100), { component: 'Shape', from: 0, durationInFrames: 90, props: { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1 } }, 'box');
    const wrapped = boxed.ok ? wrapInStack(boxed.doc, ['box'], 'stack', 'lane') : boxed;
    const padded = wrapped.ok ? setAutoLayout(wrapped.doc, 'stack', { padding: { top: 50, right: 0, bottom: 50, left: 0 } }) : wrapped;
    if (!padded.ok) {
      throw new Error(padded.error);
    }

    const fit = textAutosize(padded.doc, {}, FrameKind.Element, { w: 200, h: 50 });

    expect(fit?.node).toEqual({ w: 200, h: 100 });
    expect({ width: fit?.doc?.width, height: fit?.doc?.height }).toEqual({ width: 400, height: 200 });
  });

  it('a small node rounded to whole pixels off its stage shape still resizes', () => {
    const boxed = addClip(element(274, 53), { component: 'Shape', from: 0, durationInFrames: 90, props: { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1 } }, 'box');
    const wrapped = boxed.ok ? wrapInStack(boxed.doc, ['box'], 'stack', 'lane') : boxed;
    const padded = wrapped.ok ? setAutoLayout(wrapped.doc, 'stack', { padding: { top: 10, right: 22, bottom: 10, left: 22 } }) : wrapped;
    if (!padded.ok) {
      throw new Error(padded.error);
    }

    const fit = textAutosize(padded.doc, {}, FrameKind.Element, { w: 137, h: 27 });

    expect({ width: fit?.doc?.width, height: fit?.doc?.height }).toEqual({ width: 318, height: 73 });
    expect(fit?.node).toEqual({ w: 159, h: 37 });
  });
});
