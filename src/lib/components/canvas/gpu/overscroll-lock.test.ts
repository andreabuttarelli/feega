// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { lockOverscroll } from './overscroll-lock';

describe('lockOverscroll', () => {
  it('blocks the browser swipe navigation while the canvas is mounted', () => {
    const unlock = lockOverscroll();

    expect(document.documentElement.style.overscrollBehavior).toBe('none');
    expect(document.body.style.overscrollBehavior).toBe('none');

    unlock();
  });

  it('restores what the page had before', () => {
    document.body.style.overscrollBehavior = 'contain';

    lockOverscroll()();

    expect(document.body.style.overscrollBehavior).toBe('contain');
    expect(document.documentElement.style.overscrollBehavior).toBe('');
  });
});
