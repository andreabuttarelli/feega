import { describe, expect, it } from 'vitest';
import { Move } from '../messages';
import { BINDINGS, MOVES, Shortcut, isRedo, letterOf, shortcutOf, typingIn } from './selection-keys';

const press = (key: string, mods: { shift?: boolean; mod?: boolean } = {}, mac = true) => shortcutOf({ key, shiftKey: Boolean(mods.shift), metaKey: mac && Boolean(mods.mod), ctrlKey: !mac && Boolean(mods.mod) }, mac);

describe('selection shortcuts', () => {
  it('Delete and Backspace delete', () => {
    expect(press('Delete')).toBe(Shortcut.Delete);
    expect(press('Backspace')).toBe(Shortcut.Delete);
  });

  it('⌘D duplicates, ⌘G wraps, ⇧⌘G unwraps, ⌘A selects the siblings, ⌘C copies', () => {
    expect(press('d', { mod: true })).toBe(Shortcut.Duplicate);
    expect(press('g', { mod: true })).toBe(Shortcut.Wrap);
    expect(press('g', { mod: true, shift: true })).toBe(Shortcut.Unwrap);
    expect(press('a', { mod: true })).toBe(Shortcut.Siblings);
    expect(press('c', { mod: true })).toBe(Shortcut.Copy);
  });

  it('⇧⌘G arrives as an upper-case key and still unwraps', () => {
    expect(press('G', { mod: true, shift: true })).toBe(Shortcut.Unwrap);
  });

  it('letter shortcuts follow the physical key on a non-Latin layout', () => {
    const cyrillic = { key: 'в', code: 'KeyD', shiftKey: false, metaKey: true, ctrlKey: false };

    expect(shortcutOf(cyrillic, true)).toBe(Shortcut.Duplicate);
    expect(letterOf({ key: 'я', code: 'KeyZ' })).toBe('z');
  });

  it('a Latin layout keeps its own letter, so QWERTZ still undoes on Z', () => {
    expect(letterOf({ key: 'z', code: 'KeyY' })).toBe('z');
    expect(letterOf({ key: 'Z', code: 'KeyY' })).toBe('z');
  });

  it('keys without a letter code keep their name', () => {
    expect(letterOf({ key: 'Delete', code: 'Delete' })).toBe('delete');
    expect(letterOf({ key: '[', code: 'BracketLeft' })).toBe('[');
    expect(letterOf({ key: 'х', code: 'BracketLeft' })).toBe('[');
  });

  it('Ctrl takes the place of ⌘ off the Mac, and ⌘ does nothing there', () => {
    expect(press('d', { mod: true }, false)).toBe(Shortcut.Duplicate);
    expect(shortcutOf({ key: 'd', shiftKey: false, metaKey: true, ctrlKey: false }, false)).toBeNull();
    expect(shortcutOf({ key: 'd', shiftKey: false, metaKey: false, ctrlKey: true }, true)).toBeNull();
  });

  it('a letter without the modifier is not a shortcut', () => {
    expect(press('d')).toBeNull();
    expect(press('g')).toBeNull();
  });

  it('Delete with the modifier held is left alone', () => {
    expect(press('Delete', { mod: true })).toBeNull();
  });

  it('Escape selects the parent', () => {
    expect(press('Escape')).toBe(Shortcut.Escape);
  });

  it('Enter goes to the child, Shift+Enter to the parent', () => {
    expect(press('Enter')).toBe(Shortcut.Child);
    expect(press('Enter', { shift: true })).toBe(Shortcut.Parent);
    expect(MOVES[Shortcut.Child]).toBe(Move.Child);
    expect(MOVES[Shortcut.Parent]).toBe(Move.Parent);
  });

  it('Tab goes to the next sibling, Shift+Tab to the previous', () => {
    expect(press('Tab')).toBe(Shortcut.Next);
    expect(press('Tab', { shift: true })).toBe(Shortcut.Previous);
    expect(MOVES[Shortcut.Next]).toBe(Move.Next);
    expect(MOVES[Shortcut.Previous]).toBe(Move.Previous);
  });

  it('ignores every other key', () => {
    expect(press('x', { mod: true })).toBeNull();
    expect(press('ArrowDown')).toBeNull();
  });

  it('declares each shortcut once', () => {
    const names = BINDINGS.map((b) => `${b.key}:${b.mod}:${b.shift}`);

    expect(new Set(names).size).toBe(names.length);
  });

  it('does not steal keys while typing in a field or editable text', () => {
    expect(typingIn({ tagName: 'INPUT' })).toBe(true);
    expect(typingIn({ tagName: 'TEXTAREA' })).toBe(true);
    expect(typingIn({ tagName: 'SELECT' })).toBe(true);
    expect(typingIn({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(typingIn({ tagName: 'DIV', isContentEditable: false })).toBe(false);
    expect(typingIn(null)).toBe(false);
  });
});

describe('redo shortcut', () => {
  const key = (k: string, mods: { shift?: boolean; ctrl?: boolean; meta?: boolean }, code?: string) => ({ key: k, code, shiftKey: Boolean(mods.shift), ctrlKey: Boolean(mods.ctrl), metaKey: Boolean(mods.meta) });

  it('Ctrl+Y redoes off the Mac', () => {
    expect(isRedo(key('y', { ctrl: true }), false)).toBe(true);
  });

  it('Ctrl+Y and Cmd+Y do nothing on the Mac', () => {
    expect(isRedo(key('y', { ctrl: true }), true)).toBe(false);
    expect(isRedo(key('y', { meta: true }), true)).toBe(false);
  });

  it('Shift+Z with the modifier still redoes', () => {
    expect(isRedo(key('z', { meta: true, shift: true }), true)).toBe(true);
    expect(isRedo(key('z', { ctrl: true, shift: true }), false)).toBe(true);
  });

  it('plain undo is not redo', () => {
    expect(isRedo(key('z', { ctrl: true }), false)).toBe(false);
  });

  it('follows the physical key on a Cyrillic layout', () => {
    expect(isRedo(key('н', { ctrl: true }, 'KeyY'), false)).toBe(true);
  });
});
