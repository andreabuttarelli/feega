import { describe, expect, it } from 'vitest';
import { byId } from './by-id';

describe('byId', () => {
  it('finds a row by its id', () => {
    const rows = [{ id: 'a', n: 1 }, { id: 'b', n: 2 }];

    expect(byId(rows).get('b')).toBe(rows[1]);
    expect(byId(rows).get('missing')).toBeUndefined();
  });

  it('keeps the first of two rows sharing an id, as Array.find does', () => {
    const rows = [{ id: 'a', n: 1 }, { id: 'a', n: 2 }];

    expect(byId(rows).get('a')).toBe(rows[0]);
  });
});
