import type { LiveEditAsk } from '@feega/live-edit/live-ask';
import type { ReportFacts, SettingKey, SettingValue, Settings } from './settings';

export type Rect = { x: number; y: number; width: number; height: number };

export type Source = { file: string; line: number; col: number };

export type Pick = {
  source: Source;
  component: Source | null;
  tag: string;
  rect: Rect;
  styles: Record<string, string>;
  classes: string;
  rem: number;
  viewport: number;
  ownText: boolean;
  elements: number;
  name: string;
  ancestors: { source: Source; name: string }[];
};

export enum Move {
  Parent = 'parent',
  Child = 'child',
  Next = 'next',
  Previous = 'previous'
}

export enum Styling {
  Tailwind = 'tailwind',
  Css = 'css'
}

export type EditAsk = LiveEditAsk & { css?: Record<string, string> };

export enum ServerState {
  Detecting = 'detecting',
  Starting = 'starting',
  Running = 'running',
  Reloading = 'reloading',
  Stopped = 'stopped'
}

export enum Mode {
  Design = 'design',
  Navigate = 'navigate'
}

export enum ToHost {
  Ready = 'ready',
  Edit = 'edit',
  Undo = 'undo',
  Open = 'open',
  Picked = 'picked',
  Restart = 'restart',
  External = 'external',
  Prefs = 'prefs',
  Setting = 'setting'
}

export type Prefs = { size: string; custom: number | null; barClosed: boolean; route?: string; anchor?: string };

export enum ToView {
  App = 'app',
  Status = 'status',
  Edited = 'edited',
  Pick = 'pick',
  Change = 'change',
  Server = 'server',
  Settings = 'settings'
}

export type HostMessage =
  | { kind: ToHost.Ready }
  | { kind: ToHost.Edit; ask: EditAsk }
  | { kind: ToHost.Undo }
  | { kind: ToHost.Open; at: Source }
  | { kind: ToHost.Picked; id: number; pick: Pick | null }
  | { kind: ToHost.Restart }
  | { kind: ToHost.External; url: string }
  | { kind: ToHost.Prefs; prefs: Prefs }
  | { kind: ToHost.Setting; key: SettingKey; value: SettingValue };

export type ViewMessage =
  | { kind: ToView.App; url: string; styling: Styling; prefs: Prefs | null }
  | { kind: ToView.Server; state: ServerState; reason?: string }
  | { kind: ToView.Settings; values: Settings; facts: ReportFacts }
  | { kind: ToView.Status; text: string }
  | { kind: ToView.Edited; ok: boolean; reason?: string; written?: string; at?: Source; saved?: Source; note?: string }
  | { kind: ToView.Change; row: string; value: string }
  | { kind: ToView.Pick; id: number; x: number; y: number };

export const INSPECT = 'feega:inspect';
export const INSPECT_RESULT = 'feega:inspect:result';
export const PREVIEW = 'feega:preview';
export const PREVIEW_CLEAR = 'feega:preview:clear';
export const PREVIEW_SETTLE = 'feega:preview:settle';
export const PREVIEW_SETTLED = 'feega:preview:settled';
export const LOCATION = 'feega:location';
export const BRIDGE_READY = 'feega:source-map:ready';
export const MODE = 'feega:mode';
export const SCROLL = 'feega:scroll';
export const SCROLLED = 'feega:scrolled';
export const TEXT_EDIT = 'feega:text:edit';
export const TEXT_DONE = 'feega:text:done';

export const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+$/;
