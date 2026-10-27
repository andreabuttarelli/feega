import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { flowsOf, setFlow, startFrame } from './flows';

const plain = () => newMotionDoc(MotionFormat.Landscape);
const named = (name: string) => {
  const set = setFlow(plain(), name);
  if (!set.ok) {
    throw new Error(set.error);
  }
  return set.doc;
};

describe('setFlow', () => {
  it('marks a frame as the starting point of a flow', () => {
    const set = setFlow(plain(), 'Onboarding');

    expect(set.ok && set.doc.flow).toEqual({ name: 'Onboarding' });
  });

  it('null takes the mark off', () => {
    const cleared = setFlow(named('Onboarding'), null);

    expect(cleared.ok && cleared.doc.flow).toBeUndefined();
  });

  it('trims the name and refuses a blank one', () => {
    const trimmed = setFlow(plain(), '  Checkout  ');

    expect(trimmed.ok && trimmed.doc.flow).toEqual({ name: 'Checkout' });
    expect(setFlow(plain(), '   ').ok).toBe(false);
  });
});

describe('flowsOf', () => {
  it('lists the marked frames in canvas order', () => {
    const docs = new Map([['a', plain()], ['b', named('Checkout')], ['c', named('Onboarding')]]);

    expect(flowsOf(docs, ['c', 'a', 'b'])).toEqual([{ frame: 'c', name: 'Onboarding' }, { frame: 'b', name: 'Checkout' }]);
  });

  it('ignores order entries that have no doc', () => {
    expect(flowsOf(new Map([['b', named('X')]]), ['ghost', 'b'])).toEqual([{ frame: 'b', name: 'X' }]);
  });
});

describe('startFrame', () => {
  const docs = new Map([['a', plain()], ['b', named('Checkout')]]);

  it('prefers the frame asked for when it exists', () => {
    expect(startFrame(docs, ['a', 'b'], 'a')).toBe('a');
  });

  it('falls back to the first flow, then the first frame', () => {
    expect(startFrame(docs, ['a', 'b'], 'ghost')).toBe('b');
    expect(startFrame(new Map([['a', plain()]]), ['a'], null)).toBe('a');
  });

  it('is null when the canvas has no frame', () => {
    expect(startFrame(new Map(), [], null)).toBeNull();
  });
});
