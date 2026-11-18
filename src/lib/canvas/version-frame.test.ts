import { describe, expect, it } from 'vitest';
import { comparedWith } from './version-frame';

describe('con cosa si confronta una versione', () => {
  it('di norma con il frame da cui viene', () => {
    expect(comparedWith('v1', 'n1', [])).toBe('n1');
    expect(comparedWith('v1', 'n1', ['v1'])).toBe('n1');
  });

  it('con l’altro frame quando ne sono selezionati due', () => {
    expect(comparedWith('v1', 'n1', ['v1', 'v2'])).toBe('v2');
  });

  it('con l’originale se la coppia selezionata non la include', () => {
    expect(comparedWith('v1', 'n1', ['a', 'b'])).toBe('n1');
  });
});
