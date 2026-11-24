import type { LayerNode, Pick, Source } from '../messages';

export enum View {
  Page = 'page',
  Focus = 'focus'
}

export type Focus = { name: string; source: Source };

type Row = Omit<LayerNode, 'tag' | 'display' | 'direction' | 'position' | 'children'>;

export enum FocusKey {
  Enter = 'enter',
  Exit = 'exit'
}

export const SNAPSHOT_NOTICE = "Couldn't render in isolation: showing a snapshot";

const FOCUS_LETTER = 'f';
const ESCAPE = 'escape';

const nameOfFile = (file: string) => file.split('/').pop()!.replace(/\.[^.]+$/, '');

export const focusOf = (pick: Pick): Focus | null => (pick.component ? { name: nameOfFile(pick.source.file), source: pick.source } : null);

export function rowFocus(node: Row): Focus | null {
  if (!node.component || !node.source) {
    return null;
  }
  return { name: node.name, source: node.source };
}

export function focusKeyOf(key: string, state: { focused: boolean; available: boolean }): FocusKey | null {
  const pressed = key.toLowerCase();
  if (state.focused) {
    return pressed === ESCAPE ? FocusKey.Exit : null;
  }
  return pressed === FOCUS_LETTER && state.available ? FocusKey.Enter : null;
}
