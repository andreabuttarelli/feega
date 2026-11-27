import { describe, expect, it } from 'vitest';
import { addedKeys } from './fresh';

describe('addedKeys', () => {
  it('names the keys that were not there before', () => {
    expect(addedKeys(['a', 'b'], ['a', 'b', 'c'])).toEqual(['c']);
  });

  it('names nothing for the first list, so the whole list does not flash on load', () => {
    expect(addedKeys(null, ['a', 'b'])).toEqual([]);
  });

  it('names nothing while the list was still empty, as before the host answered', () => {
    expect(addedKeys([], ['a'])).toEqual([]);
  });

  it('names nothing when keys only went away', () => {
    expect(addedKeys(['a', 'b'], ['a'])).toEqual([]);
  });
});
