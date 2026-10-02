import { describe, expect, it } from 'vitest';
import { Decision, GROUNDS, groundOf, groundsFor } from './decisions';

describe('grounds for a decision', () => {
  it('every decision has at least one ground', () => {
    for (const decision of Object.values(Decision)) {
      expect(groundsFor(decision).length).toBeGreaterThan(0);
    }
  });

  it('every ground cites a clause of law or terms', () => {
    for (const ground of GROUNDS) {
      expect(ground.clause).toMatch(/\S/);
    }
  });

  it('a ground is accepted only for the decisions it justifies', () => {
    expect(groundOf(Decision.Remove, 'copyright')?.id).toBe('copyright');
    expect(groundOf(Decision.Dismiss, 'copyright')).toBeNull();
    expect(groundOf(Decision.Dismiss, 'no_violation')?.id).toBe('no_violation');
  });

  it('an unknown ground is refused', () => {
    expect(groundOf(Decision.Remove, 'because')).toBeNull();
  });
});
