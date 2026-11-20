import { describe, expect, it } from 'vitest';
import type { Pick } from '../messages';
import { hiddenHere, layerState, passThrough } from './layer-state';

const src = (line: number) => ({ file: 'a.svelte', line, col: 1 });
const pick = { source: src(3), ancestors: [{ source: src(1), name: 'main' }, { source: src(2), name: 'section' }] } as unknown as Pick;

describe('passThrough', () => {
  it('an unlocked element is itself', () => {
    expect(passThrough(pick, new Set())).toEqual(src(3));
  });

  it('a locked element passes the click to the nearest unlocked ancestor', () => {
    expect(passThrough(pick, new Set(['a.svelte:3:1', 'a.svelte:2:1']))).toEqual(src(1));
  });

  it('everything locked selects nothing', () => {
    expect(passThrough(pick, new Set(['a.svelte:3:1', 'a.svelte:2:1', 'a.svelte:1:1']))).toBeNull();
  });
});

describe('layerState', () => {
  it('keeps hidden and locked per route and toggles them', () => {
    const state = layerState({});
    state.toggle('hidden', '/pricing', 'a.svelte:3:1');
    state.toggle('locked', '/', 'a.svelte:2:1');

    expect(state.of('/pricing').hidden.has('a.svelte:3:1')).toBe(true);
    expect(state.of('/').hidden.size).toBe(0);
    expect(state.of('/').locked.has('a.svelte:2:1')).toBe(true);
    state.toggle('hidden', '/pricing', 'a.svelte:3:1');
    expect(state.of('/pricing').hidden.size).toBe(0);
    expect(state.saved()).toEqual({ '/pricing': { hidden: [], locked: [] }, '/': { hidden: [], locked: ['a.svelte:2:1'] } });
  });
});

describe('hiddenHere', () => {
  it('is true for display none at the current width', () => {
    expect(hiddenHere({ display: 'none' })).toBe(true);
  });

  it('is false for a shown element', () => {
    expect(hiddenHere({ display: 'flex' })).toBe(false);
  });
});
