import { describe, expect, it } from 'vitest';
import { typedCommit } from './typed-commit';

describe('a typed value', () => {
  it('is committed once when Enter and blur both report it', () => {
    const got: string[] = [];
    const typed = typedCommit((raw) => got.push(raw));

    typed.commit('37');
    typed.commit('37');

    expect(got).toEqual(['37']);
  });

  it('is committed again after the field is focused anew', () => {
    const got: string[] = [];
    const typed = typedCommit((raw) => got.push(raw));

    typed.commit('37');
    typed.focus();
    typed.commit('37');

    expect(got).toEqual(['37', '37']);
  });

  it('commits a different value right away', () => {
    const got: string[] = [];
    const typed = typedCommit((raw) => got.push(raw));

    typed.commit('37');
    typed.commit('38');

    expect(got).toEqual(['37', '38']);
  });
});
