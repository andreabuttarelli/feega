import { describe, expect, it } from 'vitest';
import { Ease } from './design';
import { newMotionDoc, MotionFormat } from './doc';
import { addClip, setProps, type OpResult } from './timeline';
import { CounterFormat, counterAt, counterSchema, counted, formatCounter, type Counter } from './text-counter';
import { setTextCounter } from './text-counter-ops';

const counter = (over: Partial<Counter> = {}): Counter => counterSchema.parse({ from: 0, to: 1000, start: 0, duration: 30, ease: Ease.Linear, ...over });

describe('formatCounter', () => {
  it.each([
    [1234.5, CounterFormat.Plain, 1, '1234.5'],
    [1234567, CounterFormat.Grouped, 0, '1,234,567'],
    [1234.5, CounterFormat.Currency, 2, '$1,234.50'],
    [42, CounterFormat.Percent, 0, '42%'],
    [1500, CounterFormat.Compact, 1, '1.5K'],
    [2_300_000, CounterFormat.Compact, 1, '2.3M'],
    [-1234, CounterFormat.Grouped, 0, '-1,234'],
    [-5, CounterFormat.Currency, 0, '-$5']
  ])('%s as %s with %s decimals is %s', (value, format, decimals, expected) => {
    expect(formatCounter(value, format, decimals)).toBe(expected);
  });
});

describe('counterAt', () => {
  it('starts at from, ends at to, and stays there after', () => {
    const c = counter({ from: 10, to: 110, format: CounterFormat.Plain });

    expect(counterAt(c, 0)).toBe('10');
    expect(counterAt(c, 15)).toBe('60');
    expect(counterAt(c, 30)).toBe('110');
    expect(counterAt(c, 90)).toBe('110');
  });

  it('holds from before its start and counts down when to is lower', () => {
    const c = counter({ from: 100, to: 0, start: 10, format: CounterFormat.Plain });

    expect(counterAt(c, 0)).toBe('100');
    expect(counterAt(c, 40)).toBe('0');
  });

  it('follows its ease', () => {
    const fast = counter({ format: CounterFormat.Plain, ease: Ease.Enter });

    expect(Number(counterAt(fast, 15))).toBeGreaterThan(500);
  });
});

describe('setTextCounter', () => {
  const must = (r: OpResult) => {
    if (!r.ok) {
      throw new Error(r.error);
    }
    return r.doc;
  };

  const doc = () => {
    const base = newMotionDoc(MotionFormat.Landscape);
    const added = addClip(base, { component: 'Text', from: 0, durationInFrames: 90 }, 't');
    if (!added.ok) {
      throw new Error(added.error);
    }
    return added.doc;
  };

  it('puts a counter on a Text clip and removes it with null', () => {
    const on = setTextCounter(doc(), 't', { from: 0, to: 500 });
    expect(on.ok && on.doc.tracks[0].clips[0].props.counter).toMatchObject({ from: 0, to: 500 });

    const off = on.ok ? setTextCounter(on.doc, 't', null) : on;
    expect(off.ok && off.doc.tracks[0].clips[0].props.counter).toBeUndefined();
  });

  it('refuses a clip that has styled ranges', () => {
    const styled = must(setProps(doc(), 't', { runs: [{ start: 0, end: 3, weight: 700 }] }));

    expect(setTextCounter(styled, 't', { from: 0, to: 1 }).ok).toBe(false);
  });

  it('refuses a component with no text', () => {
    const base = doc();
    const shape = addClip(base, { component: 'Shape', from: 0, durationInFrames: 30 }, 's');
    const result = shape.ok ? setTextCounter(shape.doc, 's', { from: 0, to: 1 }) : shape;

    expect(result.ok).toBe(false);
  });
});

describe('counted', () => {
  it('replaces the text with the number at the frame', () => {
    const props = { text: 'x', counter: counter({ from: 0, to: 100, format: CounterFormat.Plain }) };

    expect(counted('Text', props, 30).text).toBe('100');
    expect(counted('Text', { text: 'x' }, 30).text).toBe('x');
    expect(counted('Custom', props, 30).text).toBe('x');
  });
});
