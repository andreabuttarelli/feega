import { describe, expect, it } from 'vitest';
import { TypeAhead } from './type-ahead';

const key = (k: string, mods: Partial<KeyboardEvent> = {}) => ({ key: k, metaKey: false, ctrlKey: false, altKey: false, ...mods }) as KeyboardEvent;

describe('letters typed before a new text box opens', () => {
  it('nothing is held until a text is being created', () => {
    const ahead = new TypeAhead();
    expect(ahead.take(key('e'), 0)).toBe(false);
  });

  it('letters typed while the text box opens are kept for it, never run as shortcuts', () => {
    const ahead = new TypeAhead();
    ahead.hold(0);
    expect(['S', 'h', 'a', 'r', 'e', 'd'].every((k) => ahead.take(key(k), 10))).toBe(true);
    expect(ahead.release()).toBe('Shared');
    expect(ahead.take(key('e'), 20)).toBe(false);
  });

  it('backspace removes the last held letter', () => {
    const ahead = new TypeAhead();
    ahead.hold(0);
    ahead.take(key('a'), 1);
    ahead.take(key('b'), 1);
    expect(ahead.take(key('Backspace'), 1)).toBe(true);
    expect(ahead.release()).toBe('a');
  });

  it('modified keys and escape still reach the canvas, and escape ends the hold', () => {
    const ahead = new TypeAhead();
    ahead.hold(0);
    expect(ahead.take(key('z', { metaKey: true }), 1)).toBe(false);
    expect(ahead.take(key('Escape'), 1)).toBe(false);
    expect(ahead.take(key('e'), 2)).toBe(false);
  });

  it('a text box that never opens stops holding keys', () => {
    const ahead = new TypeAhead();
    ahead.hold(0);
    expect(ahead.take(key('e'), 60_000)).toBe(false);
    expect(ahead.release()).toBe('');
  });
});
