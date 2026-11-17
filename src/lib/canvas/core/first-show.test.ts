import { describe, expect, it } from 'vitest';
import { beforeMediaGroup, showsBeforeMedia } from './first-show';

describe('what a live build shows before its images load', () => {
  it('a breakpoint view shown for the first time paints its vectors without waiting for images', () => {
    expect(showsBeforeMedia('n1@bp:phone', false)).toBe(true);
  });

  it('a view already on screen keeps it until the images are ready', () => {
    expect(showsBeforeMedia('n1@bp:phone', true)).toBe(false);
  });

  it('a base frame live rebuild waits for its images as before', () => {
    expect(showsBeforeMedia('n1', false)).toBe(false);
  });

  it('the vectors shown before the images load go out under a group the whole view never reuses', () => {
    expect(beforeMediaGroup('n1@bp:phone:live1')).not.toBe('n1@bp:phone:live1');
  });
});
