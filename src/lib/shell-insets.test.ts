import { describe, expect, it } from 'vitest';
import { shellLeftOf } from './shell-insets';

describe('the timeline left offset', () => {
  it('reaches the floating gap when no left panel is open', () => {
    expect(shellLeftOf(null)).toBe('12px');
  });

  it('starts after the rail and the panel when one is open', () => {
    expect(shellLeftOf('assets')).toContain('68px');
  });
});
