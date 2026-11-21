import { Move } from '../messages';

export enum Shortcut {
  Delete = 'delete',
  Duplicate = 'duplicate',
  Wrap = 'wrap',
  Unwrap = 'unwrap',
  Siblings = 'siblings',
  Copy = 'copy',
  Escape = 'escape',
  Parent = 'parent',
  Child = 'child',
  Next = 'next',
  Previous = 'previous'
}

type Binding = { shortcut: Shortcut; key: string; mod: boolean; shift?: boolean };

export const BINDINGS: Binding[] = [
  { shortcut: Shortcut.Delete, key: 'delete', mod: false },
  { shortcut: Shortcut.Delete, key: 'backspace', mod: false },
  { shortcut: Shortcut.Duplicate, key: 'd', mod: true },
  { shortcut: Shortcut.Wrap, key: 'g', mod: true, shift: false },
  { shortcut: Shortcut.Unwrap, key: 'g', mod: true, shift: true },
  { shortcut: Shortcut.Siblings, key: 'a', mod: true },
  { shortcut: Shortcut.Copy, key: 'c', mod: true },
  { shortcut: Shortcut.Escape, key: 'escape', mod: false },
  { shortcut: Shortcut.Child, key: 'enter', mod: false, shift: false },
  { shortcut: Shortcut.Parent, key: 'enter', mod: false, shift: true },
  { shortcut: Shortcut.Next, key: 'tab', mod: false, shift: false },
  { shortcut: Shortcut.Previous, key: 'tab', mod: false, shift: true }
];

export const MOVES: Partial<Record<Shortcut, Move>> = {
  [Shortcut.Parent]: Move.Parent,
  [Shortcut.Child]: Move.Child,
  [Shortcut.Next]: Move.Next,
  [Shortcut.Previous]: Move.Previous
};

type Press = { key: string; shiftKey: boolean; metaKey: boolean; ctrlKey: boolean };

export function shortcutOf(e: Press, mac: boolean): Shortcut | null {
  const mod = mac ? e.metaKey : e.ctrlKey;
  const stray = mac ? e.ctrlKey : e.metaKey;
  const key = e.key.toLowerCase();
  if (stray) {
    return null;
  }

  return BINDINGS.find((b) => b.key === key && b.mod === mod && (b.shift === undefined || b.shift === e.shiftKey))?.shortcut ?? null;
}

const FIELDS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export const typingIn = (target: { tagName: string; isContentEditable?: boolean } | null): boolean => target !== null && (FIELDS.has(target.tagName) || Boolean(target.isContentEditable));

export const needsBareFocus = (shortcut: Shortcut): boolean => BINDINGS.some((b) => b.shortcut === shortcut && !b.mod);

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
