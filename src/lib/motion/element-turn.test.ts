import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, setKeyframes, type OpResult } from '@feega/motion-core/motion/timeline';
import { turnClips, QUARTER_TURN } from './layer-props';
import { wrapInStack } from './layout/ops';
import { elementTurn } from './element-turn';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const stack = (() => {
  const doc = { ...newMotionDoc(MotionFormat.Landscape), still: { frame: 0 }, width: 400, height: 100 } as MotionDoc;
  const texted = must(addClip(doc, { component: 'Text', from: 0, props: { text: 'Ciao', x: 0.25, y: 0.5, width: 0.5, height: 1 } }, 'a'));
  const two = must(addClip(texted, { component: 'Text', from: 0, props: { text: 'Ciao', x: 0.75, y: 0.5, width: 0.5, height: 1 } }, 'b'));
  return must(wrapInStack(two, ['a', 'b'], 'stack', 'lane'));
})();

describe('rotating a free element turns its node, not its content inside the node', () => {
  it('a Stack turned 90° hands the turn to the node and stays upright in its own doc', () => {
    const turned = elementTurn(must(turnClips(stack, ['stack'], QUARTER_TURN)))!;

    expect(turned.degrees).toBe(QUARTER_TURN);
    expect(findClip(turned.doc, 'stack')!.clip.transform.rotateZ ?? 0).toBe(0);
  });

  it('an upright element has nothing to hand over', () => {
    expect(elementTurn(stack)).toBeNull();
  });

  it('a turn a child takes inside the Stack stays with the child', () => {
    expect(elementTurn(must(turnClips(stack, ['a'], QUARTER_TURN)))).toBeNull();
  });

  it('an animated turn stays in the doc, where its keyframes live', () => {
    const animated = must(setKeyframes(stack, 'stack', 'rotateZ', [{ frame: 0, value: 0 }, { frame: 10, value: 90 }]));

    expect(elementTurn(animated)).toBeNull();
  });
});
