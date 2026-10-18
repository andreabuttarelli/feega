import { describe, expect, it } from 'vitest';
import { nextLive } from './frame-live';

describe('the frame running live on the canvas', () => {
  it('turns on the switched frame, and only that one', () => {
    expect(nextLive(null, 'a')).toBe('a');
    expect(nextLive('a', 'b')).toBe('b');
  });

  it('turns off when its own switch is pressed again', () => {
    expect(nextLive('a', 'a')).toBeNull();
  });
});
