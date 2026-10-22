import { describe, expect, it } from 'vitest';
import { paidGateFor, promotePath } from './promote-sheet';

describe('paidGateFor', () => {
  const ready = { hasBrand: true, hasAdAccount: true, hasMedia: true };

  it.each([
    [{ ...ready, hasBrand: false, hasAdAccount: false }, 'no_brand'],
    [{ ...ready, hasAdAccount: false }, 'no_ad_account'],
    [{ ...ready, hasMedia: false }, 'no_media'],
    [ready, 'ready']
  ] as const)('%o → %s', (readiness, gate) => {
    expect(paidGateFor(readiness)).toBe(gate);
  });
});

describe('promotePath', () => {
  it('carries the selection', () => {
    expect(promotePath(['a', 'b'])).toBe('/promote?nodeIds=a,b');
    expect(promotePath([])).toBe('/promote');
  });
});
