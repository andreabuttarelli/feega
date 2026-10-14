import { describe, expect, it } from 'vitest';
import { FOLDS_KEY, readFolds, toggleFold } from './layer-folds';

function memory(seed: Record<string, string> = {}) {
  const data = { ...seed };
  return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v) };
}

describe('folded frames in Layers', () => {
  it('every frame starts unfolded', () => {
    expect(readFolds(memory()).size).toBe(0);
  });

  it('a fold is remembered per frame and survives a reload', () => {
    const store = memory();
    toggleFold(store, toggleFold(store, new Set(), 'a'), 'b');

    expect([...readFolds(store)]).toEqual(['a', 'b']);
  });

  it('folding twice unfolds', () => {
    const store = memory();
    toggleFold(store, toggleFold(store, new Set(), 'a'), 'a');

    expect(readFolds(store).size).toBe(0);
  });

  it('a corrupt or blocked store reads as nothing folded', () => {
    expect(readFolds(memory({ [FOLDS_KEY]: '{' })).size).toBe(0);
    expect(readFolds({ getItem: () => { throw new Error('blocked'); }, setItem: () => {} }).size).toBe(0);
  });
});
