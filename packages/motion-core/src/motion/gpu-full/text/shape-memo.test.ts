import { describe, expect, it } from 'vitest';
import { Ligatures, Op, type Shaped } from './face';
import { memoOutline, memoShape } from './shape-memo';

function counted() {
  const calls: string[] = [];
  const shape = (text: string, ligatures: Ligatures, features?: Record<string, boolean>): Shaped[] => {
    calls.push(`${text}|${ligatures}|${JSON.stringify(features ?? {})}`);
    return [...text].map((_, i) => ({ glyph: i, advance: 10, dx: 0, dy: 0, chars: 1 }));
  };
  return { calls, shape };
}

describe('memoShape', () => {
  it('shapes the same run once when a frame is laid out again', () => {
    const { calls, shape } = counted();
    const memo = memoShape(shape);

    const first = memo('Close the month', Ligatures.On);
    const again = memo('Close the month', Ligatures.On);

    expect(again).toEqual(first);
    expect(calls).toHaveLength(1);
  });

  it('keeps ligatures and features apart', () => {
    const { calls, shape } = counted();
    const memo = memoShape(shape);

    memo('fi', Ligatures.On);
    memo('fi', Ligatures.Off);
    memo('fi', Ligatures.On, { smcp: true });
    memo('fi', Ligatures.On, { smcp: true });

    expect(calls).toHaveLength(3);
  });

  it('forgets the oldest runs past its limit', () => {
    const { calls, shape } = counted();
    const memo = memoShape(shape, 2);

    memo('a', Ligatures.On);
    memo('b', Ligatures.On);
    memo('c', Ligatures.On);
    memo('a', Ligatures.On);

    expect(calls).toHaveLength(4);
  });
});

describe('memoOutline', () => {
  it('reads each glyph outline from the font once', () => {
    const read: number[] = [];
    const outline = memoOutline((glyph) => {
      read.push(glyph);
      return [{ op: Op.Move, at: [glyph, 0] }];
    });

    outline(7);
    outline(7);
    outline(9);

    expect(read).toEqual([7, 9]);
  });
});
