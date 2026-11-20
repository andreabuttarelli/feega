import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Column, openTarget } from './open-source';

describe('openTarget', () => {
  it('apre il file relativo al workspace alla riga e colonna, accanto al pannello se occupa la prima colonna', () => {
    expect(openTarget('/w', { file: 'src/home.ts', line: 12, col: 14 }, 1)).toEqual({ path: join('/w', 'src/home.ts'), line: 11, col: 13, column: Column.Beside });
  });

  it('un percorso assoluto resta quello, e senza pannello nella prima colonna apre nella prima', () => {
    expect(openTarget('/w', { file: '/abs/A.svelte', line: 1, col: 0 }, 2)).toEqual({ path: '/abs/A.svelte', line: 0, col: 0, column: Column.First });
  });
});
