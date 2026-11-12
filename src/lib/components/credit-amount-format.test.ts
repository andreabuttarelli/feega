import { describe, expect, it } from 'vitest';
import { formatCredits, formatPrice } from './credit-amount-format';

describe('formatCredits — a credit is a ledger unit, 100 to the euro', () => {
  it('shows the units as whole credits', () => {
    expect(formatCredits(14)).toBe('14');
    expect(formatCredits(500)).toBe('500');
  });

  it('groups thousands', () => {
    expect(formatCredits(997951)).toBe('997,951');
  });

  it('says "<1" for a cost under one credit instead of "0"', () => {
    expect(formatCredits(0.4)).toBe('<1');
  });

  it('prefixes an approximate amount with a tilde', () => {
    expect(formatCredits(14, { approx: true })).toBe('~14');
  });

  it('shows zero as 0', () => {
    expect(formatCredits(0)).toBe('0');
  });
});

describe('formatPrice — the run price next to every Generate button', () => {
  it('writes euros, 100 credits to the euro, with a dot and a € prefix', () => {
    expect(formatPrice(2)).toBe('€0.02');
    expect(formatPrice(144)).toBe('€1.44');
  });

  it('says < €0.01 for a price that rounds to zero', () => {
    expect(formatPrice(0.4)).toBe('< €0.01');
  });
});
