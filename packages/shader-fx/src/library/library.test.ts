import { describe, expect, it } from 'vitest';
import { parseEffect } from '../effect';
import { lintFrag } from '../lint';
import { LibraryGenre, SHADER_LIBRARY } from './index';

const STATEFUL = /\b(u_frame|u_delta|u_prev|u_last)\b/;

const rows = SHADER_LIBRARY.map((s) => [s.name, s] as const);

describe('SHADER_LIBRARY', () => {
  it('holds one shader per genre', () => {
    expect(SHADER_LIBRARY.map((s) => s.genre).sort()).toEqual(Object.values(LibraryGenre).sort());
  });

  it.each(rows)('%s is a valid custom effect', (_, shader) => {
    expect(parseEffect({ name: shader.name, frag: shader.frag, params: shader.params })).toMatchObject({ ok: true });
  });

  it.each(rows)('%s passes the lint', (_, shader) => {
    expect(lintFrag(shader.frag, shader.params)).toEqual([]);
  });

  it.each(rows)('%s reads no state beyond time and params', (_, shader) => {
    expect(shader.frag).not.toMatch(STATEFUL);
  });

  it.each(rows)('%s describes its look', (_, shader) => {
    expect(shader.description.length).toBeGreaterThan(40);
  });
});
