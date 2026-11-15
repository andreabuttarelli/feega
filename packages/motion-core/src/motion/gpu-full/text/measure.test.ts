import { describe, expect, it, vi } from 'vitest';
import { shapedText } from './measure';
import type { Typeset } from './painter';

const UNIT = 1000;
const WIDTH = 200;

describe('shapedText', () => {
  it('measures a text it has already measured without serialising its props again', () => {
    const measure = shapedText({ fonts: new Map() as unknown as Typeset['fonts'], smoothing: 'none' as Typeset['smoothing'] });
    const props = { text: 'Ship faster', size: 0.04 };
    const first = measure('Shape', props, UNIT, WIDTH);
    const stringify = vi.spyOn(JSON, 'stringify');

    const again = measure('Shape', props, UNIT, WIDTH);

    const calls = stringify.mock.calls.length;
    stringify.mockRestore();
    expect(again).toEqual(first);
    expect(calls).toBe(0);
  });
});
