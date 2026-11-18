import { request } from './api.ts';

export enum LiveProp {
  Text = 'text',
  Color = 'color',
  Fill = 'fill',
  FontSize = 'fontSize',
  FontWeight = 'fontWeight',
  Padding = 'padding',
  Margin = 'margin',
  Gap = 'gap',
  Radius = 'radius'
}

export enum LiveSide {
  X = 'x',
  Y = 'y',
  Top = 't',
  Right = 'r',
  Bottom = 'b',
  Left = 'l'
}

export type LiveEditAsk = { at: string; prop: LiveProp; value?: string; token?: string; side?: LiveSide; was?: string; viewport?: number };

export type LiveEdited = { ok: true; sha: string; files: string[]; token: string | null; patch: string };

export type LiveChanges = { branch: string; files: string[]; patch: string };

export type LivePushed = { ok: true; branch: string; sha: string; pull: { url: string } | null };

const PATH = '/api/v1/local/live-edit';

const posted = <T>(path: string, token: string, body: unknown) => request<T>(path, token, { method: 'POST', body: JSON.stringify(body) });

export const liveEditApi = (token: string, ask: LiveEditAsk) => posted<LiveEdited>(PATH, token, ask);

export const liveUndoApi = (token: string, sha: string) => posted<LiveEdited>(PATH, token, { undo: sha });

export const liveChangesApi = (token: string) => request<LiveChanges>(PATH, token);

export const livePushApi = (token: string) => posted<LivePushed>(`${PATH}/push`, token, {});
