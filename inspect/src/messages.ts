import type { LiveEditAsk } from '@feega/live-edit/live-ask';

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
};

export enum ToHost {
  Ready = 'ready',
  Edit = 'edit',
  Undo = 'undo',
  Open = 'open',
  Picked = 'picked'
}

export enum ToView {
  App = 'app',
  Status = 'status',
  Edited = 'edited',
  Pick = 'pick'
}

export type HostMessage =
  | { kind: ToHost.Ready }
  | { kind: ToHost.Edit; ask: LiveEditAsk }
  | { kind: ToHost.Undo }
  | { kind: ToHost.Open; at: Source }
  | { kind: ToHost.Picked; id: number; pick: Pick | null };

export type ViewMessage =
  | { kind: ToView.App; url: string }
  | { kind: ToView.Status; text: string }
  | { kind: ToView.Edited; ok: boolean; reason?: string; written?: string }
  | { kind: ToView.Pick; id: number; x: number; y: number };

export const INSPECT = 'feega:inspect';
export const INSPECT_RESULT = 'feega:inspect:result';
export const PREVIEW = 'feega:preview';
export const BRIDGE_READY = 'feega:source-map:ready';

export const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+$/;
