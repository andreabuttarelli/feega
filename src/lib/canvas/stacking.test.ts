import { describe, expect, it } from 'vitest';
import { Stack, restacked } from './stacking';

const layers = [
  { id: 'a', z: 0 },
  { id: 'b', z: 2 },
  { id: 'c', z: 5 }
];

describe('restacked', () => {
  it('lifts the picked nodes above every other one, keeping their order', () => {
    expect(restacked(layers, ['b', 'a'], Stack.Front)).toEqual([
      { id: 'a', z: 6 },
      { id: 'b', z: 7 }
    ]);
  });

  it('drops the picked nodes below every other one, keeping their order', () => {
    expect(restacked(layers, ['c', 'b'], Stack.Back)).toEqual([
      { id: 'b', z: -2 },
      { id: 'c', z: -1 }
    ]);
  });

  it('ignores ids that are not on the canvas', () => {
    expect(restacked(layers, ['ghost'], Stack.Front)).toEqual([]);
  });
});
