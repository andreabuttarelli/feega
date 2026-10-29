import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { Direction } from '@feega/motion-core/motion/layout/auto-layout';
import { withAutoLayout } from '@feega/motion-core/motion/layout/resolve';
import { guessedBoxes } from '../move-element';
import { setAutoLayout, wrapInStack } from './ops';
import { StackDrop, dragInStack } from './stack-drag';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const shape = (x: number, y = 0.3) => ({ component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect', x, y, width: 0.1, height: 0.1 } }) as const;

const doc = (() => {
  let d = newMotionDoc(MotionFormat.Square);
  for (const [id, x] of [['a', 0.1], ['b', 0.25], ['c', 0.4]] as const) {
    d = must(addClip(d, shape(x), id));
  }
  d = must(addClip(d, shape(0.2, 0.8), 'p'));
  d = must(addClip(d, shape(0.5, 0.8), 'q'));
  d = must(wrapInStack(d, ['a', 'b', 'c'], 'row', 'lane-row'));
  d = must(wrapInStack(d, ['p', 'q'], 'col', 'lane-col'));
  return must(setAutoLayout(d, 'col', { direction: Direction.Vertical }));
})();

const boxes = guessedBoxes(withAutoLayout(doc));
const centreOf = (id: string): [number, number] => [boxes[id].left + boxes[id].width / 2, boxes[id].top + boxes[id].height / 2];
const order = (d: MotionDoc, id: string) => findClip(d, id)?.clip.autoLayout?.order;

describe('dragging a stack child', () => {
  it('reorders it inside its stack and shows where it lands', () => {
    const [, y] = centreOf('c');
    const dropped = dragInStack(doc, 'a', boxes, [boxes.c.left + boxes.c.width - 1, y]);
    expect(dropped.kind).toBe(StackDrop.Reorder);
    expect(order(must(dropped.result), 'row')).toEqual(['b', 'c', 'a']);
    expect(dropped.line).not.toBeNull();
  });

  it('never moves it freely inside the stack', () => {
    const dropped = dragInStack(doc, 'a', boxes, centreOf('a'));
    const moved = must(dropped.result);
    expect(findClip(moved, 'a')?.clip.props).toEqual(findClip(doc, 'a')?.clip.props);
  });

  it('moves it into another stack it is dropped on', () => {
    const [x, y] = centreOf('q');
    const dropped = dragInStack(doc, 'a', boxes, [x, y + 1]);
    expect(dropped.kind).toBe(StackDrop.Join);
    const moved = must(dropped.result);
    expect(findClip(moved, 'a')?.clip.parent).toBe('col');
    expect(order(moved, 'col')).toEqual(['p', 'q', 'a']);
  });

  it('takes it out of the stack when dropped clearly outside', () => {
    const dropped = dragInStack(doc, 'a', boxes, [900, 50]);
    expect(dropped.kind).toBe(StackDrop.Leave);
    const moved = must(dropped.result);
    expect(findClip(moved, 'a')?.clip.parent).toBeNull();
    expect(dropped.line).toBeNull();
  });
});
