import { describe, expect, it } from 'vitest';
import { formatCredits, formatPrice } from './credit-amount-format';

describe('formatCredits', () => {
  it('divides units by 100 with two decimals', () => {
    expect(formatCredits(14)).toBe('0.14');
    expect(formatCredits(5)).toBe('0.05');
  });

  it('groups thousands on the divided value', () => {
    expect(formatCredits(997951)).toBe('9,979.51');
  });

  it('floors very small costs to "<0.01" instead of "0.00"', () => {
    expect(formatCredits(0.4)).toBe('<0.01');
  });

  it('prefixes an approximate amount with a tilde', () => {
    expect(formatCredits(14, { approx: true })).toBe('~0.14');
  });

  it('does not show "<0.01" for zero', () => {
    expect(formatCredits(0)).toBe('0.00');
  });
});

describe('formatPrice — the run price next to every Generate button', () => {
  it('writes dollars with a dot and a $ prefix, whatever the locale', () => {
    expect(formatPrice(2)).toBe('$0.02');
    expect(formatPrice(144)).toBe('$1.44');
  });

  it('says < $0.01 for a price that rounds to zero', () => {
    expect(formatPrice(0.4)).toBe('< $0.01');
  });
});
