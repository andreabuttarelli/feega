import { DEFAULT_THEME, ThemeKind, type Apply, type Theme } from '@feega/live-edit/themes';
import type { LayerNode, Pick, Source } from '../messages';

export enum View {
  Page = 'page',
  Focus = 'focus'
}

export type FocusUsage = { at: Source; which: { index: number; count: number } };

export type Focus = { name: string; source: Source; index: number; usage: FocusUsage | null; alone?: true };

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

const MOUNT_ERROR_DEFAULT = 'Static copy: this component cannot run on its own';

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

export function focusKeyOf(key: string, state: { open: boolean; available: boolean }): FocusKey | null {
  const pressed = key.toLowerCase();
  if (state.open) {
    return pressed === ESCAPE ? FocusKey.Exit : null;
  }
  return pressed === FOCUS_LETTER && state.available ? FocusKey.Enter : null;
}

const HOME_ROUTE = '/';

export const backLabelOf = (route: string): string => (route && route !== HOME_ROUTE ? route : 'Home');

export enum Scheme {
  Light = 'light',
  Dark = 'dark'
}

const DARK_THEME = /dark/i;

export const themeOfScheme = (themes: Theme[], scheme: Scheme): string | null => (scheme === Scheme.Light ? DEFAULT_THEME : (themes.find((theme) => DARK_THEME.test(theme.name))?.name ?? null));

export const schemeOf = (themes: Theme[], active: string): Scheme => (DARK_THEME.test(active) && themes.some((theme) => theme.name === active) ? Scheme.Dark : Scheme.Light);

const MEDIA_DARK: Apply = { kind: ThemeKind.Media, target: 'html', value: 'dark' };

export const schemeApplyOf = (themes: Theme[], active: string, scheme: Scheme): Apply | null => {
  const dark = themeOfScheme(themes, Scheme.Dark);
  if (scheme === Scheme.Dark && dark === null) {
    return MEDIA_DARK;
  }
  return themes.find((theme) => theme.name === (scheme === Scheme.Dark && dark ? dark : active))?.apply ?? null;
};

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;
export const REAL_SIZE = 1;
const ZOOM_STEP = 0.25;
const WHEEL_SPEED = 0.01;

export const stepZoom = (zoom: number, direction: 1 | -1): number => Math.min(Math.max(zoom + direction * ZOOM_STEP, MIN_ZOOM), MAX_ZOOM);

export const wheelFactor = (deltaY: number): number => Math.exp(-deltaY * WHEEL_SPEED);
