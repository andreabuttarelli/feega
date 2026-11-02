import { describe, expect, it } from 'vitest';
import { type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { blankElement } from '$lib/motion/draw-create';
import { wrapInStack } from '$lib/motion/layout/ops';
import { Root, ownClipOf } from './frame-select';
import { parentPick } from './frame-scope';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const sheet = must(blankElement({ left: 0, top: 0, width: 200, height: 60 }));
const texted = must(addClip(sheet, { component: 'Text', from: 0, props: { text: 'Hello', x: 0.5, y: 0.5, width: 1, height: 1 } }, 't'));
const stackNode = must(wrapInStack(texted, ['t'], 'stack', 'lane'));

describe('a free Stack node holding one text', () => {
  it('picks the Stack as its own clip, not the text', () => {
    expect(ownClipOf(stackNode)).toBe('stack');
  });

  it('picks a lone free text as its own clip', () => {
    expect(ownClipOf(texted)).toBe('t');
  });

  it('Esc from the text goes to the Stack', () => {
    expect(parentPick(stackNode, 't', Root.Own)).toBe('stack');
  });

  it('a frame still skips its full-frame page', () => {
    expect(parentPick(stackNode, 't', Root.Page)).toBeNull();
  });
});
