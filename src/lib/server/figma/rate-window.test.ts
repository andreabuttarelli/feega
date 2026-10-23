import { describe, expect, it } from 'vitest';
import { rateWindow } from './rate-window';

describe('a rate window lets a key through a few times per window', () => {
  it('refuses past the limit and forgets after the window', () => {
    const window = rateWindow({ limit: 2, windowMs: 1000 });

    expect(window.allow('u1', 0)).toBe(true);
    expect(window.allow('u1', 10)).toBe(true);
    expect(window.allow('u1', 20)).toBe(false);
    expect(window.allow('u2', 20)).toBe(true);
    expect(window.allow('u1', 1100)).toBe(true);
  });
});
