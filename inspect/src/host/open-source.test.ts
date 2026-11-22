import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Column, openTarget, revealColumn } from './open-source';

describe('openTarget', () => {
  it('apre il file relativo al workspace alla riga e colonna, accanto al pannello se occupa la prima colonna', () => {
    expect(openTarget('/w', { file: 'src/home.ts', line: 12, col: 14 }, 1)).toEqual({ path: join('/w', 'src/home.ts'), line: 11, col: 13, column: Column.Beside });
  });

  it('un percorso assoluto resta quello, e senza pannello nella prima colonna apre nella prima', () => {
    expect(openTarget('/w', { file: '/abs/A.svelte', line: 1, col: 0 }, 2)).toEqual({ path: '/abs/A.svelte', line: 0, col: 0, column: Column.First });
  });
});

describe('revealColumn', () => {
  it('never splits the panel: with the panel alone in its group there is nowhere to reveal', () => {
    expect(revealColumn(1, [1])).toBeNull();
  });

  it('reveals in the first group that is not the panel', () => {
    expect(revealColumn(2, [1, 2])).toBe(1);
    expect(revealColumn(1, [1, 2, 3])).toBe(2);
  });
});
