import { describe, expect, it } from 'vitest';
import { Move } from '../messages';
import { SelectionKey, selectionKey } from './selection-keys';

describe('selection keys', () => {
  it('Escape only clears the selection', () => {
    expect(selectionKey({ key: 'Escape', shiftKey: false })).toEqual({ kind: SelectionKey.Clear });
  });

  it('Enter goes to the child, Shift+Enter to the parent', () => {
    expect(selectionKey({ key: 'Enter', shiftKey: false })).toEqual({ kind: SelectionKey.Move, move: Move.Child });
    expect(selectionKey({ key: 'Enter', shiftKey: true })).toEqual({ kind: SelectionKey.Move, move: Move.Parent });
  });

  it('Tab goes to the next sibling, Shift+Tab to the previous', () => {
    expect(selectionKey({ key: 'Tab', shiftKey: false })).toEqual({ kind: SelectionKey.Move, move: Move.Next });
    expect(selectionKey({ key: 'Tab', shiftKey: true })).toEqual({ kind: SelectionKey.Move, move: Move.Previous });
  });

  it('ignores other keys', () => {
    expect(selectionKey({ key: 'a', shiftKey: false })).toBeNull();
  });
});
