// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOVER_DELAY_MS, LONG_PRESS_MS, placeTip, tip } from './tooltip';

const shown = () => document.querySelector<HTMLElement>('[role="tooltip"]');

const pointer = (type: string, pointerType: string) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { pointerType });
  return event;
};

describe('tooltip', () => {
  let button: HTMLButtonElement;
  let clicks: number;
  let handle: ReturnType<typeof tip>;
  const count = () => clicks++;

  beforeEach(() => {
    vi.useFakeTimers();
    clicks = 0;
    button = document.createElement('button');
    document.body.append(button);
    document.body.addEventListener('click', count);
    handle = tip(button, { name: 'Split clip', keys: '⇧⌘D' });
  });

  afterEach(() => {
    handle.destroy();
    document.body.removeEventListener('click', count);
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  it('shows at once on keyboard focus, name and shortcut', () => {
    button.dispatchEvent(new FocusEvent('focus'));

    expect(shown()?.textContent).toContain('Split clip');
    expect(shown()?.textContent).toContain('⇧⌘D');
  });

  it('a key pressed on the focused button hides it, so a shortcut dialog is not covered', () => {
    button.dispatchEvent(new FocusEvent('focus'));
    button.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));

    expect(shown()).toBeNull();
  });

  it('waits for the hover delay before showing', () => {
    button.dispatchEvent(pointer('pointerenter', 'mouse'));
    vi.advanceTimersByTime(HOVER_DELAY_MS - 50);
    expect(shown()).toBeNull();

    vi.advanceTimersByTime(100);
    expect(shown()).not.toBeNull();

    button.dispatchEvent(pointer('pointerleave', 'mouse'));
    expect(shown()).toBeNull();
  });

  it('a long press shows the name and the click that follows does not fire', () => {
    button.dispatchEvent(pointer('pointerdown', 'touch'));
    vi.advanceTimersByTime(LONG_PRESS_MS + 10);
    expect(shown()?.textContent).toContain('Split clip');

    button.dispatchEvent(pointer('pointerup', 'touch'));
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(clicks).toBe(0);
  });

  it('a short tap still fires and shows nothing', () => {
    button.dispatchEvent(pointer('pointerdown', 'touch'));
    vi.advanceTimersByTime(100);
    button.dispatchEvent(pointer('pointerup', 'touch'));
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(clicks).toBe(1);
    expect(shown()).toBeNull();
  });

  it('a mouse click does not pop the tooltip through focus', () => {
    button.dispatchEvent(pointer('pointerdown', 'mouse'));
    button.dispatchEvent(new FocusEvent('focus'));

    expect(shown()).toBeNull();
  });
});

describe('placement', () => {
  const view = { width: 390, height: 800 };

  it('sits under the anchor, centred', () => {
    expect(placeTip({ left: 100, top: 10, width: 40, height: 40 }, { width: 80, height: 24 }, view)).toEqual({ left: 80, top: 56 });
  });

  it('stays on screen at the right edge and flips above at the bottom', () => {
    expect(placeTip({ left: 370, top: 760, width: 20, height: 40 }, { width: 120, height: 24 }, view)).toEqual({ left: 262, top: 730 });
  });
});
