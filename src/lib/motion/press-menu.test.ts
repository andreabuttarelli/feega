// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LONG_PRESS_MS } from './tooltip';
import { pressMenu } from './press-menu';

vi.mock('$lib/native-actions', () => ({ haptic: () => undefined }));

const touch = (type: string, x = 10, y = 10, pointerId = 1) => Object.assign(new MouseEvent(type, { clientX: x, clientY: y }), { pointerType: 'touch', pointerId });

describe('pressMenu', () => {
  let node: HTMLElement;
  let open: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    node = document.createElement('div');
    open = vi.fn();
    pressMenu(node, open);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('a touch long-press opens the same menu a right click does', () => {
    node.dispatchEvent(touch('pointerdown'));
    vi.advanceTimersByTime(LONG_PRESS_MS);

    expect(open).toHaveBeenCalledWith({ x: 10, y: 10 });
  });

  it('a second finger cancels the long-press: a pinch never opens the menu', () => {
    node.dispatchEvent(touch('pointerdown', 10, 10, 1));
    node.dispatchEvent(touch('pointerdown', 80, 80, 2));
    vi.advanceTimersByTime(LONG_PRESS_MS);

    expect(open).not.toHaveBeenCalled();
  });
});
