import { describe, expect, it } from 'vitest';
import { composerHeight } from './composer-height';

describe("l'altezza del composer", () => {
  it('segue il contenuto', () => {
    expect(composerHeight(72)).toBe('72px');
  });

  it('si ferma al massimo', () => {
    expect(composerHeight(900)).toBe('200px');
  });

  it('montato nascosto non si schiaccia a zero: lascia decidere al CSS', () => {
    expect(composerHeight(0)).toBe('');
  });
});
