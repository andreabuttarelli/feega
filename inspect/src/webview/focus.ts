import type { LayerNode, Pick, Source } from '../messages';

export type Focus = { name: string; source: Source; index?: number };

type Row = Omit<LayerNode, 'tag' | 'display' | 'direction' | 'position' | 'children'>;

export enum FocusKey {
  Enter = 'enter',
  Exit = 'exit'
}

const FOCUS_LETTER = 'f';
const ESCAPE = 'escape';

const nameOfFile = (file: string) => file.split('/').pop()!.replace(/\.[^.]+$/, '');

export const focusOf = (pick: Pick): Focus | null => (pick.component ? { name: nameOfFile(pick.source.file), source: pick.source } : null);

export function rowFocus(node: Row): Focus | null {
  if (!node.component || !node.source) {
    return null;
  }
  return node.count > 1 ? { name: node.name, source: node.source } : { name: node.name, source: node.source, index: node.instance };
}

export const focusLabel = (focus: Focus, count: number): string => `${focus.name} · ${count} ${count === 1 ? 'instance' : 'instances'}`;

export function focusKeyOf(key: string, state: { focused: boolean; available: boolean }): FocusKey | null {
  const pressed = key.toLowerCase();
  if (state.focused) {
    return pressed === ESCAPE || pressed === FOCUS_LETTER ? FocusKey.Exit : null;
  }
  return pressed === FOCUS_LETTER && state.available ? FocusKey.Enter : null;
}
