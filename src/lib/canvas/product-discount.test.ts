import { describe, expect, it } from 'vitest';
import { discountPercent, saleLabel } from './product-discount';

describe('etichetta del saldo', () => {
  it('uno sconto diventa −N%', () => {
    expect(saleLabel(98, 140)).toBe('−30%');
  });

  it('nessuno sconto, nessuna etichetta', () => {
    expect(saleLabel(98, null)).toBeNull();
  });
});

describe('sconto', () => {
  it('senza prezzo barrato non c\'è sconto', () => {
    expect(discountPercent(50, null)).toBeNull();
  });

  it('un barrato uguale o più basso non è uno sconto', () => {
    expect(discountPercent(50, 50)).toBeNull();
    expect(discountPercent(50, 40)).toBeNull();
  });

  it('senza prezzo non c\'è sconto', () => {
    expect(discountPercent(null, 100)).toBeNull();
  });

  it('un barrato più alto dà la percentuale arrotondata', () => {
    expect(discountPercent(98, 140)).toBe(30);
    expect(discountPercent(42, 45)).toBe(7);
  });

  it('uno sconto che arrotonda a zero non è uno sconto', () => {
    expect(discountPercent(99.9, 100)).toBeNull();
  });
});
