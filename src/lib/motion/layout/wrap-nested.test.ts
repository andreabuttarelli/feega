import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { withAutoLayout } from '@feega/motion-core/motion/layout/resolve';
import { apply2d, worldAt } from '@feega/motion-core/motion/parent';
import { wrapInGroup, wrapInStack, wrapWithStack } from './ops';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const PRECISION = 3;

const button = (() => {
  let doc = newMotionDoc(MotionFormat.Square);
  doc = must(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect', x: 0.3, y: 0.3, width: 0.2, height: 0.1 } }, 'a'));
  doc = must(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect', x: 0.3, y: 0.6, width: 0.3, height: 0.1 } }, 'pill'));
  doc = must(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect', x: 0.3, y: 0.6, width: 0.1, height: 0.05 } }, 'label'));
  doc = must(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect', x: 0.5, y: 0.1, width: 0.8, height: 0.05 } }, 'z'));
  doc = must(wrapInGroup(doc, ['pill', 'label'], 'btn', 'lane-btn'));
  return must(wrapInStack(doc, ['a', 'btn'], 'inner', 'lane-inner'));
})();

const centre = (doc: MotionDoc, id: string) => {
  const laid = withAutoLayout(doc);
  const props = findClip(laid, id)!.clip.props as { x: number; y: number };
  return apply2d(worldAt(laid, id, 0, { width: doc.width, height: doc.height }), [props.x * doc.width, props.y * doc.height]).map((v) => Number(v.toFixed(PRECISION)));
};

describe('wrapping a stack that holds a group', () => {
  it('carries the pill and label along with their group', () => {
    let n = 0;
    const { result } = wrapWithStack(button, ['z', 'inner'], () => `new-${n++}`);
    const wrapped = must(result);

    expect(centre(wrapped, 'label')).toEqual(centre(wrapped, 'pill'));
    expect(centre(wrapped, 'pill')).toEqual(centre(wrapped, 'btn'));
  });
});
