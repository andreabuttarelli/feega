import { describe, expect, it } from 'vitest';
import { DeepRefusal, deepRefusal } from './start';

describe('when a Deep job may not start', () => {
  it('starts when the credits cover the quote and nothing else runs on the node', () => {
    expect(deepRefusal({ balance: 5000, quoteCredits: 2000, running: false })).toBeNull();
  });

  it('refuses when the balance does not cover the quote', () => {
    expect(deepRefusal({ balance: 1999, quoteCredits: 2000, running: false })).toBe(DeepRefusal.Credits);
  });

  it('refuses a second job on the same video', () => {
    expect(deepRefusal({ balance: 5000, quoteCredits: 2000, running: true })).toBe(DeepRefusal.Running);
  });
});
