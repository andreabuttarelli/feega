import { describe, expect, it } from 'vitest';
import { nestsInItself } from './group-cycle';

const parents = new Map<string, string | null>([['a', 'b'], ['b', 'c'], ['c', null], ['d', null]]);

describe('nestsInItself: a node can never end up inside its own group', () => {
  it('joining itself is a cycle', () => {
    expect(nestsInItself(parents, 'd', 'd')).toBe(true);
  });

  it('joining one of its own descendants is a cycle', () => {
    expect(nestsInItself(parents, 'c', 'a')).toBe(true);
  });

  it('joining an unrelated group is fine', () => {
    expect(nestsInItself(parents, 'd', 'a')).toBe(false);
    expect(nestsInItself(parents, 'a', null)).toBe(false);
  });

  it('a cycle already in the data does not hang the check', () => {
    const looped = new Map<string, string | null>([['x', 'y'], ['y', 'x']]);
    expect(nestsInItself(looped, 'z', 'x')).toBe(false);
  });
});
