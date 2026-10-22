import { describe, expect, it } from 'vitest';
import { Align, Direction, Justify, Sizing, layoutTree, measure, type Flow, type Item } from './auto-layout';

const flow = (over: Partial<Flow> = {}): Flow => ({
  direction: Direction.Horizontal,
  wrap: false,
  gap: 0,
  crossGap: 0,
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
  justify: Justify.Start,
  align: Align.Start,
  ...over
});

const leaf = (id: string, width: number, height: number, over: Partial<Item> = {}): Item => ({ id, width, height, sizing: { width: Sizing.Fixed, height: Sizing.Fixed }, ...over });

const box = (id: string, width: number, height: number, children: Item[], f: Partial<Flow> = {}, over: Partial<Item> = {}): Item => ({ ...leaf(id, width, height), flow: flow(f), children, ...over });

const hug = { width: Sizing.Hug, height: Sizing.Hug };

describe('a row', () => {
  it('lays fixed children left to right with the gap', () => {
    const out = layoutTree(box('c', 300, 100, [leaf('a', 50, 20), leaf('b', 60, 30)], { gap: 10 }));
    expect(out.get('a')).toEqual({ left: 0, top: 0, width: 50, height: 20 });
    expect(out.get('b')).toEqual({ left: 60, top: 0, width: 60, height: 30 });
  });

  it('starts inside the padding', () => {
    const out = layoutTree(box('c', 300, 100, [leaf('a', 50, 20)], { padding: { top: 5, right: 0, bottom: 0, left: 7 } }), { left: 100, top: 200 });
    expect(out.get('c')).toEqual({ left: 100, top: 200, width: 300, height: 100 });
    expect(out.get('a')).toEqual({ left: 107, top: 205, width: 50, height: 20 });
  });

  it.each([
    [Justify.Start, [0, 60]],
    [Justify.Center, [90, 150]],
    [Justify.End, [180, 240]],
    [Justify.SpaceBetween, [0, 240]]
  ])('justifies %s', (justify, lefts) => {
    const out = layoutTree(box('c', 300, 100, [leaf('a', 50, 20), leaf('b', 60, 20)], { gap: 10, justify }));
    expect([out.get('a')!.left, out.get('b')!.left]).toEqual(lefts);
  });

  it.each([
    [Justify.SpaceAround, [45, 195]],
    [Justify.SpaceEvenly, [60, 180]]
  ])('distributes %s', (justify, lefts) => {
    const out = layoutTree(box('c', 300, 100, [leaf('a', 50, 20), leaf('b', 60, 20)], { gap: 10, justify }));
    expect(out.get('a')!.left).toBeCloseTo(lefts[0], 1);
    expect(out.get('b')!.left).toBeCloseTo(lefts[1], 1);
  });

  it('a negative gap overlaps the children', () => {
    const out = layoutTree(box('c', 300, 100, [leaf('a', 50, 20), leaf('b', 60, 20)], { gap: -20 }, { sizing: hug }));
    expect(out.get('b')!.left).toBe(30);
    expect(out.get('c')!.width).toBe(90);
  });

  it('space-between with one child sits at the start', () => {
    const out = layoutTree(box('c', 300, 100, [leaf('a', 50, 20)], { justify: Justify.SpaceBetween }));
    expect(out.get('a')!.left).toBe(0);
  });

  it.each([
    [Align.Start, 0],
    [Align.Center, 40],
    [Align.End, 80]
  ])('aligns the cross axis %s', (align, top) => {
    const out = layoutTree(box('c', 300, 100, [leaf('a', 50, 20)], { align }));
    expect(out.get('a')!.top).toBe(top);
  });

  it('a fill child takes the space left on the main axis', () => {
    const out = layoutTree(box('c', 300, 100, [leaf('a', 50, 20), leaf('b', 10, 20, { sizing: { width: Sizing.Fill, height: Sizing.Fixed } })], { gap: 10, padding: { top: 0, right: 20, bottom: 0, left: 20 } }));
    expect(out.get('b')).toEqual({ left: 80, top: 0, width: 200, height: 20 });
  });

  it('two fill children share it equally', () => {
    const fill = { sizing: { width: Sizing.Fill, height: Sizing.Fixed } };
    const out = layoutTree(box('c', 210, 100, [leaf('a', 0, 20, fill), leaf('b', 0, 20, fill)], { gap: 10 }));
    expect(out.get('a')!.width).toBe(100);
    expect(out.get('b')).toEqual({ left: 110, top: 0, width: 100, height: 20 });
  });

  it('a fill child clamped by max gives the rest to the others', () => {
    const fill = { sizing: { width: Sizing.Fill, height: Sizing.Fixed } };
    const out = layoutTree(box('c', 300, 100, [leaf('a', 0, 20, { ...fill, max: { width: 50 } }), leaf('b', 0, 20, fill)]));
    expect(out.get('a')!.width).toBe(50);
    expect(out.get('b')!.width).toBe(250);
  });

  it('a fill child never shrinks below its min', () => {
    const out = layoutTree(box('c', 100, 100, [leaf('a', 90, 20), leaf('b', 0, 20, { sizing: { width: Sizing.Fill, height: Sizing.Fixed }, min: { width: 30 } })]));
    expect(out.get('b')!.width).toBe(30);
  });

  it('fill on the cross axis stretches to the inner height', () => {
    const out = layoutTree(box('c', 300, 100, [leaf('a', 50, 20, { sizing: { width: Sizing.Fixed, height: Sizing.Fill } })], { padding: { top: 10, right: 0, bottom: 10, left: 0 } }));
    expect(out.get('a')).toEqual({ left: 0, top: 10, width: 50, height: 80 });
  });

  it('min and max clamp a fixed child', () => {
    const out = layoutTree(box('c', 300, 100, [leaf('a', 500, 1, { min: { height: 10 }, max: { width: 120 } })]));
    expect(out.get('a')).toEqual({ left: 0, top: 0, width: 120, height: 10 });
  });

  it('justify uses the space a fill child leaves, none', () => {
    const out = layoutTree(box('c', 300, 100, [leaf('a', 0, 20, { sizing: { width: Sizing.Fill, height: Sizing.Fixed } }), leaf('b', 50, 20)], { justify: Justify.End }));
    expect(out.get('a')!.left).toBe(0);
    expect(out.get('b')!.left).toBe(250);
  });
});

describe('a column', () => {
  it('lays children top to bottom and aligns them horizontally', () => {
    const out = layoutTree(box('c', 100, 300, [leaf('a', 50, 20), leaf('b', 80, 30)], { direction: Direction.Vertical, gap: 5, align: Align.Center }));
    expect(out.get('a')).toEqual({ left: 25, top: 0, width: 50, height: 20 });
    expect(out.get('b')).toEqual({ left: 10, top: 25, width: 80, height: 30 });
  });

  it('a fill child takes the height left', () => {
    const out = layoutTree(box('c', 100, 300, [leaf('a', 50, 100), leaf('b', 50, 0, { sizing: { width: Sizing.Fill, height: Sizing.Fill } })], { direction: Direction.Vertical }));
    expect(out.get('b')).toEqual({ left: 0, top: 100, width: 100, height: 200 });
  });
});

describe('hug', () => {
  it('a hugging row is its children plus gaps and padding', () => {
    const c = box('c', 0, 0, [leaf('a', 50, 20), leaf('b', 60, 30)], { gap: 10, padding: { top: 1, right: 2, bottom: 3, left: 4 } }, { sizing: hug });
    expect(measure(c)).toEqual({ width: 126, height: 34 });
    expect(layoutTree(c).get('c')).toEqual({ left: 0, top: 0, width: 126, height: 34 });
  });

  it('a hugging column', () => {
    const c = box('c', 0, 0, [leaf('a', 50, 20), leaf('b', 60, 30)], { direction: Direction.Vertical, gap: 10 }, { sizing: hug });
    expect(measure(c)).toEqual({ width: 60, height: 60 });
  });

  it('an empty hugging container is its padding', () => {
    expect(measure(box('c', 0, 0, [], { padding: { top: 5, right: 5, bottom: 5, left: 5 } }, { sizing: hug }))).toEqual({ width: 10, height: 10 });
  });

  it('hugs one axis and keeps the other fixed', () => {
    const c = box('c', 500, 40, [leaf('a', 50, 20)], {}, { sizing: { width: Sizing.Hug, height: Sizing.Fixed } });
    expect(measure(c)).toEqual({ width: 50, height: 40 });
  });

  it('a hugging leaf keeps its intrinsic size', () => {
    const out = layoutTree(box('c', 300, 100, [leaf('t', 77, 12, { sizing: hug })]));
    expect(out.get('t')).toEqual({ left: 0, top: 0, width: 77, height: 12 });
  });

  it('a fill child inside a hugging container counts at its own size', () => {
    const c = box('c', 0, 0, [leaf('a', 40, 20, { sizing: { width: Sizing.Fill, height: Sizing.Fixed } }), leaf('b', 60, 20)], { gap: 10 }, { sizing: hug });
    expect(measure(c).width).toBe(110);
  });
});

describe('wrap', () => {
  const tiles = ['a', 'b', 'c', 'd', 'e'].map((id) => leaf(id, 40, 20));

  it('breaks into lines when the main axis is full', () => {
    const out = layoutTree(box('c', 100, 200, tiles, { wrap: true, gap: 10, crossGap: 5 }));
    expect(out.get('a')).toEqual({ left: 0, top: 0, width: 40, height: 20 });
    expect(out.get('b')).toEqual({ left: 50, top: 0, width: 40, height: 20 });
    expect(out.get('c')).toEqual({ left: 0, top: 25, width: 40, height: 20 });
    expect(out.get('e')).toEqual({ left: 0, top: 50, width: 40, height: 20 });
  });

  it('a hugging height grows with the lines', () => {
    const c = box('c', 100, 0, tiles, { wrap: true, gap: 10, crossGap: 5 }, { sizing: { width: Sizing.Fixed, height: Sizing.Hug } });
    expect(measure(c)).toEqual({ width: 100, height: 70 });
  });

  it('justifies every line on its own', () => {
    const out = layoutTree(box('c', 100, 200, tiles.slice(0, 3), { wrap: true, gap: 10, justify: Justify.Center }));
    expect(out.get('a')!.left).toBe(5);
    expect(out.get('c')!.left).toBe(30);
  });

  it('aligns children inside the tallest of their line', () => {
    const out = layoutTree(box('c', 100, 200, [leaf('a', 40, 10), leaf('b', 40, 30), leaf('c', 40, 10)], { wrap: true, gap: 10, align: Align.End }));
    expect(out.get('a')!.top).toBe(20);
    expect(out.get('c')!.top).toBe(30);
  });

  it('a child longer than the line still gets a line of its own', () => {
    const out = layoutTree(box('c', 100, 200, [leaf('a', 150, 10), leaf('b', 40, 10)], { wrap: true }));
    expect(out.get('a')!.top).toBe(0);
    expect(out.get('b')!.top).toBe(10);
  });

  it('fill children grow inside their line', () => {
    const fill = { sizing: { width: Sizing.Fill, height: Sizing.Fixed } };
    const out = layoutTree(box('c', 100, 200, [leaf('a', 60, 10, fill), leaf('b', 60, 10, fill)], { wrap: true }));
    expect(out.get('a')).toEqual({ left: 0, top: 0, width: 100, height: 10 });
    expect(out.get('b')).toEqual({ left: 0, top: 10, width: 100, height: 10 });
  });
});

describe('absolute children', () => {
  it('stay out of the flow and keep their own box', () => {
    const out = layoutTree(box('c', 300, 100, [leaf('x', 10, 10, { absolute: true }), leaf('a', 50, 20)]));
    expect(out.has('x')).toBe(false);
    expect(out.get('a')!.left).toBe(0);
  });

  it('do not count for a hugging container', () => {
    expect(measure(box('c', 0, 0, [leaf('x', 999, 999, { absolute: true }), leaf('a', 50, 20)], {}, { sizing: hug }))).toEqual({ width: 50, height: 20 });
  });
});

describe('nesting', () => {
  it('places the inner container and then its children', () => {
    const inner = box('i', 0, 0, [leaf('p', 20, 20), leaf('q', 30, 20)], { gap: 5 }, { sizing: hug });
    const out = layoutTree(box('c', 300, 100, [leaf('a', 50, 50), inner], { gap: 10, align: Align.Center, padding: { top: 0, right: 0, bottom: 0, left: 8 } }), { left: 1000, top: 0 });
    expect(out.get('i')).toEqual({ left: 1068, top: 40, width: 55, height: 20 });
    expect(out.get('q')).toEqual({ left: 1093, top: 40, width: 30, height: 20 });
  });

  it('a fill inner container passes its width to its own fill child', () => {
    const inner = box('i', 0, 0, [leaf('p', 0, 20, { sizing: { width: Sizing.Fill, height: Sizing.Fixed } })], { padding: { top: 0, right: 10, bottom: 0, left: 10 } }, { sizing: { width: Sizing.Fill, height: Sizing.Hug } });
    const out = layoutTree(box('c', 300, 100, [leaf('a', 100, 20), inner]));
    expect(out.get('i')).toEqual({ left: 100, top: 0, width: 200, height: 20 });
    expect(out.get('p')).toEqual({ left: 110, top: 0, width: 180, height: 20 });
  });

  it('a hugging root grows with a hugging grandchild', () => {
    const inner = box('i', 0, 0, [leaf('p', 20, 70)], { padding: { top: 5, right: 5, bottom: 5, left: 5 } }, { sizing: hug });
    expect(measure(box('c', 0, 0, [inner, leaf('a', 10, 10)], { gap: 2 }, { sizing: hug }))).toEqual({ width: 42, height: 80 });
  });

  it('a wrapping inner container hugs its height from the width it gets', () => {
    const tiles = ['p', 'q', 'r'].map((id) => leaf(id, 40, 10));
    const inner = box('i', 0, 0, tiles, { wrap: true }, { sizing: { width: Sizing.Fill, height: Sizing.Hug } });
    const out = layoutTree(box('c', 80, 300, [inner], { direction: Direction.Vertical }));
    expect(out.get('i')).toEqual({ left: 0, top: 0, width: 80, height: 20 });
    expect(out.get('r')).toEqual({ left: 0, top: 10, width: 40, height: 10 });
  });
});

describe('the root', () => {
  it('fill on the root behaves as fixed', () => {
    const out = layoutTree(box('c', 300, 100, [], {}, { sizing: { width: Sizing.Fill, height: Sizing.Fill } }));
    expect(out.get('c')).toEqual({ left: 0, top: 0, width: 300, height: 100 });
  });

  it('a leaf root is its own box', () => {
    expect(layoutTree(leaf('a', 5, 6)).get('a')).toEqual({ left: 0, top: 0, width: 5, height: 6 });
  });
});

describe('a grid', () => {
  const grid = (over: Partial<Flow> = {}) => ({ direction: Direction.Grid, columns: 2, gap: 10, crossGap: 20, ...over });

  it('splits the width into equal columns and starts a row every few children', () => {
    const out = layoutTree(box('c', 210, 300, [leaf('a', 50, 40), leaf('b', 50, 60), leaf('d', 50, 30)], grid()));
    expect(out.get('a')).toEqual({ left: 0, top: 0, width: 50, height: 40 });
    expect(out.get('b')).toEqual({ left: 110, top: 0, width: 50, height: 60 });
    expect(out.get('d')).toEqual({ left: 0, top: 80, width: 50, height: 30 });
  });

  it('a filling child takes its whole cell', () => {
    const fill = { width: Sizing.Fill, height: Sizing.Fill };
    const out = layoutTree(box('c', 210, 300, [leaf('a', 10, 40), leaf('b', 10, 10, { sizing: fill })], grid()));
    expect(out.get('b')).toEqual({ left: 110, top: 0, width: 100, height: 40 });
  });

  it('aligns a child inside its cell', () => {
    const out = layoutTree(box('c', 210, 300, [leaf('a', 50, 40), leaf('b', 50, 20)], grid({ align: Align.End, justify: Justify.Center })));
    expect(out.get('b')).toEqual({ left: 135, top: 20, width: 50, height: 20 });
  });

  it('hugs its widest child per column and its rows', () => {
    const size = measure(box('c', 0, 0, [leaf('a', 50, 40), leaf('b', 70, 60), leaf('d', 50, 30)], grid({ padding: { top: 1, right: 2, bottom: 3, left: 4 } }), { sizing: hug }));
    expect(size).toEqual({ width: 4 + 70 + 10 + 70 + 2, height: 1 + 60 + 20 + 30 + 3 });
  });
});
