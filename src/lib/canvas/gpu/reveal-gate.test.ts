import { describe, expect, it } from 'vitest';
import { REVEAL_WAIT_MS, revealIn } from './reveal-gate';

describe('when the canvas shows itself', () => {
  it('shows as soon as every node in view has its preview', () => {
    expect(revealIn(0, 10)).toBe(0);
  });

  it('waits for missing previews, but never longer than the cap', () => {
    expect(revealIn(3, 100)).toBe(REVEAL_WAIT_MS - 100);
    expect(revealIn(3, REVEAL_WAIT_MS + 50)).toBe(0);
  });
});
