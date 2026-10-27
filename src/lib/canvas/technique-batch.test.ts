import { describe, expect, it } from 'vitest';
import { BATCH_MAX_ROWS, autoMapping, batchRowValues, parseRows } from './technique-batch';

describe('parseRows', () => {
  it('reads one row per pasted line', () => {
    expect(parseRows('red shoe\nblue shoe\n\n')).toEqual([['red shoe'], ['blue shoe']]);
  });

  it('reads csv with quoted commas and tabs', () => {
    expect(parseRows('a,"b, c"\nd\te')).toEqual([['a', 'b, c'], ['d', 'e']]);
  });
});

describe('autoMapping', () => {
  it('maps columns to slots in order and leaves extra slots unmapped', () => {
    expect(autoMapping(3, 2)).toEqual([0, 1, null]);
  });
});

describe('batchRowValues', () => {
  const inputs = [{ node: 0, type: 'text' }, { node: 2, type: 'image' }];

  it('gives each mapped slot its column value', () => {
    expect(batchRowValues(inputs, [1, 0], ['https://x/i.png', 'a cat'])).toEqual([
      { node: 0, value: 'a cat' },
      { node: 2, value: 'https://x/i.png' }
    ]);
  });

  it('skips unmapped and empty cells', () => {
    expect(batchRowValues(inputs, [null, 1], ['a', ' '])).toEqual([]);
  });
});

it('caps a batch', () => {
  expect(BATCH_MAX_ROWS).toBe(50);
});
