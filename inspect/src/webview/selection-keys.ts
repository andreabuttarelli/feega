import { Move } from '../messages';

export enum SelectionKey {
  Clear = 'clear',
  Move = 'move'
}

export type SelectionAction = { kind: SelectionKey.Clear } | { kind: SelectionKey.Move; move: Move };

type Press = { key: string; shiftKey: boolean };

const SELECTION_KEYS: Record<string, (e: Press) => SelectionAction> = {
  Escape: () => ({ kind: SelectionKey.Clear }),
  Enter: (e) => ({ kind: SelectionKey.Move, move: e.shiftKey ? Move.Parent : Move.Child }),
  Tab: (e) => ({ kind: SelectionKey.Move, move: e.shiftKey ? Move.Previous : Move.Next })
};

export const selectionKey = (e: Press): SelectionAction | null => SELECTION_KEYS[e.key]?.(e) ?? null;
