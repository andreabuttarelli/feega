import type { LayerNode, Pick, Source } from '../messages';

export enum View {
  Page = 'page',
  Focus = 'focus'
}

export type FocusUsage = { at: Source; which: { index: number; count: number } };

export type Focus = { name: string; source: Source; index: number; usage: FocusUsage | null };

type Row = Omit<LayerNode, 'tag' | 'display' | 'direction' | 'position' | 'children'>;

export enum FocusKey {
  Enter = 'enter',
  Exit = 'exit'
}

export enum SnapshotReason {
  Turbopack = 'turbopack',
  MountError = 'mount_error',
  NoAdapter = 'no_adapter',
  Timeout = 'timeout',
  UnsupportedFramework = 'unsupported_framework'
}

const MOUNT_ERROR_DEFAULT = 'Snapshot: it failed to render alone';

const MOUNT_ERROR_NOTICE: Record<string, string> = {
  provider: 'Snapshot: needs a provider or context',
  not_exported: 'Snapshot: the component is not exported',
  load: 'Snapshot: its module failed to load'
};

const NOTICE: Record<SnapshotReason, (detail?: string) => string> = {
  [SnapshotReason.Turbopack]: () => 'Snapshot: Turbopack cannot mount components',
  [SnapshotReason.MountError]: (detail) => MOUNT_ERROR_NOTICE[detail ?? ''] ?? MOUNT_ERROR_DEFAULT,
  [SnapshotReason.NoAdapter]: () => 'Snapshot: the dev server has no Feega mount page',
  [SnapshotReason.Timeout]: () => 'Snapshot: it rendered nothing in time',
  [SnapshotReason.UnsupportedFramework]: () => 'Snapshot: this framework cannot mount alone'
};

export const snapshotNoticeOf = (reason: string | null | undefined, detail?: string): string | null => NOTICE[reason as SnapshotReason]?.(detail) ?? null;

const FOCUS_LETTER = 'f';
const ESCAPE = 'escape';

const nameOfFile = (file: string) => file.split('/').pop()!.replace(/\.[^.]+$/, '');

export const focusOf = (pick: Pick): Focus | null => (pick.component ? { name: nameOfFile(pick.source.file), source: pick.source, index: pick.instanceIndex, usage: { at: pick.component, which: pick.usage } } : null);

export function rowFocus(node: Row): Focus | null {
  if (!node.component || !node.source) {
    return null;
  }
  return { name: node.name, source: node.source, index: node.instance, usage: null };
}

export function focusKeyOf(key: string, state: { focused: boolean; available: boolean }): FocusKey | null {
  const pressed = key.toLowerCase();
  if (state.focused) {
    return pressed === ESCAPE ? FocusKey.Exit : null;
  }
  return pressed === FOCUS_LETTER && state.available ? FocusKey.Enter : null;
}
