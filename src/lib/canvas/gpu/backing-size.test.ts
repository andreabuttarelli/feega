import { describe, expect, it } from 'vitest';
import { grownBacking } from './backing-size';

describe('grownBacking — the GPU canvas only reallocates when the surface outgrows it', () => {
  it('a surface that shrinks keeps the backing store, so a panel opening costs no realloc', () => {
    expect(grownBacking({ width: 1116, height: 852 }, { width: 1396, height: 852 })).toBeNull();
  });

  it('a surface that grows in either side gets a backing store covering both maxima', () => {
    expect(grownBacking({ width: 1396, height: 600 }, { width: 1116, height: 852 })).toEqual({ width: 1396, height: 852 });
  });

  it('an unchanged surface needs nothing', () => {
    expect(grownBacking({ width: 800, height: 600 }, { width: 800, height: 600 })).toBeNull();
  });
});
