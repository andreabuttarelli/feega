import { describe, expect, it } from 'vitest';
import { keyboardOpen } from './keyboard-inset';

describe('la tastiera su mobile', () => {
  it('chiusa quando il viewport visibile coincide col layout', () => {
    expect(keyboardOpen({ layoutHeight: 844, visibleHeight: 844 })).toBe(false);
  });

  it('chiusa quando la barra del browser si ritrae di poco', () => {
    expect(keyboardOpen({ layoutHeight: 844, visibleHeight: 790 })).toBe(false);
  });

  it('aperta quando il viewport visibile perde un terzo', () => {
    expect(keyboardOpen({ layoutHeight: 844, visibleHeight: 500 })).toBe(true);
  });
});
