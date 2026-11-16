import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { Direction } from '@feega/motion-core/motion/layout/auto-layout';
import { withAutoLayout } from '@feega/motion-core/motion/layout/resolve';
import { guessedBoxes } from '../move-element';
import { setAutoLayout, wrapInStack } from './ops';
import { StackDrop, dragInStack, dropInStack, followCursor, holdInStack, stackLineAt } from './stack-drag';

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
  d = must(addClip(d, shape(0.9, 0.5), 'free'));
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

describe('dragging an element that is not in a stack', () => {
  it('drops it into the stack under the cursor, at the slot it shows', () => {
    const [x, y] = centreOf('b');
    const dropped = dropInStack(doc, 'free', boxes, [x - 1, y]);
    expect(dropped?.kind).toBe(StackDrop.Join);
    const moved = must(dropped!.result);
    expect(findClip(moved, 'free')?.clip.parent).toBe('row');
    expect(order(moved, 'row')).toEqual(['a', 'free', 'b', 'c']);
    expect(dropped?.line).not.toBeNull();
  });

  it('leaves it a plain move when no stack is under the cursor', () => {
    expect(dropInStack(doc, 'free', boxes, [boxes.free.left + 1, boxes.free.top + 1])).toBeNull();
  });

  it('never drops a stack into itself', () => {
    const [x, y] = centreOf('a');
    expect(dropInStack(doc, 'row', boxes, [x, y])).toBeNull();
  });
});

describe('while a stack child is dragged', () => {
  it('follows the cursor by the distance dragged, its slot held open', () => {
    const shown = must(followCursor(doc, 'a', [40, 25]));
    const moved = findClip(shown, 'a')!.clip;

    expect(moved.transform.x).toBeCloseTo(40 / doc.width);
    expect(moved.transform.y).toBeCloseTo(25 / doc.height);
    expect(moved.parent).toBe('row');
    expect(order(shown, 'row')).toEqual(order(doc, 'row'));
  });
});

describe('while an element from outside the frame is dragged over it', () => {
  it('shows the slot it would take in the stack under the cursor', () => {
    const [x, y] = centreOf('b');
    expect(stackLineAt(doc, [x - 1, y])).toEqual(dropInStack(doc, 'free', boxes, [x - 1, y])!.line);
  });

  it('shows nothing where no stack is under the cursor', () => {
    expect(stackLineAt(doc, [boxes.free.left + 1, boxes.free.top + 1])).toBeNull();
  });
});

describe('holding a stack child while it is dragged', () => {
  const drawnBox = (d: MotionDoc, id: string) => {
    const laid = guessedBoxes(withAutoLayout(d))[id];
    const t = findClip(d, id)!.clip.transform;
    return { left: laid.left + (t.x ?? 0) * d.width, top: laid.top + (t.y ?? 0) * d.height };
  };

  it('the siblings already stand in the order it will land in, laid out by the stack itself', () => {
    const hold = holdInStack(doc, 'c', boxes);
    const from = centreOf('c');
    const shown = must(hold(from, [boxes.a.left + 1, from[1]]).shown);

    expect(guessedBoxes(withAutoLayout(shown)).a.left).toBeCloseTo(guessedBoxes(withAutoLayout(must(dragInStack(doc, 'c', boxes, [boxes.a.left + 1, from[1]]).result))).a.left, 3);
    expect(guessedBoxes(withAutoLayout(shown)).a.left).toBeGreaterThan(boxes.a.left);
  });

  it('the dragged child stays under the pointer, wherever the stack lays it', () => {
    const hold = holdInStack(doc, 'c', boxes);
    const from = centreOf('c');
    const to: [number, number] = [boxes.a.left + 1, from[1] + 7];
    const drawn = drawnBox(must(hold(from, to).shown), 'c');

    expect(drawn.left).toBeCloseTo(boxes.c.left + to[0] - from[0], 3);
    expect(drawn.top).toBeCloseTo(boxes.c.top + to[1] - from[1], 3);
  });

  it('lays the stack out again only when the landing slot changes', () => {
    const hold = holdInStack(doc, 'c', boxes);
    const from = centreOf('c');
    const first = hold(from, [boxes.a.left + 1, from[1]]);
    const second = hold(from, [boxes.a.left + 2, from[1]]);

    expect(second.dragged.result).toBe(first.dragged.result);
  });
});
