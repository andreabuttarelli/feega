import { request } from './api.ts';

export type HistoryLane = { key: string; kind: string; label: string };

export type HistoryEntry = { id: string; source: string; kind: string; at: string; lane: number; node_id: string | null; frame_id: string | null; subject: string | null; session_id: string | null; summary: string | null };

export type History = { canvas_id: string; lanes: HistoryLane[]; entries: HistoryEntry[] };

export type HistoryAsk = { canvasId: string; author?: string; frame?: string };

function query(ask: HistoryAsk, org?: string): string {
  const params = new URLSearchParams(Object.entries({ author: ask.author, frame: ask.frame, org }).flatMap(([k, v]) => (v ? [[k, v]] : [])));
  const text = params.toString();
  return text ? `?${text}` : '';
}

export enum PointAction {
  Preview = 'preview',
  Restore = 'restore',
  Name = 'name',
  Merge = 'merge',
  Drop = 'drop',
  Revert = 'revert'
}

export enum Keep {
  Mine = 'mine',
  Reject = 'reject'
}

export type KeepChoice = { path: string; keep: Keep };

export type PointAsk = { canvasId: string; entryId: string; action: `${PointAction}`; name?: string; keep?: string; choices?: KeepChoice[]; confirm?: boolean };

const POINT_METHOD: Record<PointAction, string> = { [PointAction.Preview]: 'GET', [PointAction.Restore]: 'POST', [PointAction.Name]: 'POST', [PointAction.Merge]: 'POST', [PointAction.Drop]: 'POST', [PointAction.Revert]: 'POST' };

const KEEPS = new Set<string>(Object.values(Keep));

export function keepChoices(pairs: string[]): KeepChoice[] {
  return pairs.map((pair) => {
    const at = pair.lastIndexOf('=');
    const keep = pair.slice(at + 1);
    if (at < 1 || !KEEPS.has(keep)) {
      throw new Error(`--keep ${pair}: write <field>=mine or <field>=reject`);
    }
    return { path: pair.slice(0, at), keep: keep as Keep };
  });
}

export type ResolveAsk = { canvasId: string; conflictId: string; keep: string };

export type ResolveAnswer = { resolved?: boolean; keep?: string; error?: string; message?: string };

export const historyApi = {
  list: (token: string, ask: HistoryAsk, org?: string) => request<History>(`/api/v1/canvas/${encodeURIComponent(ask.canvasId)}/history${query(ask, org)}`, token),
  at: (token: string, ask: PointAsk, org?: string) => {
    const method = POINT_METHOD[ask.action as PointAction];
    const path = `/api/v1/canvas/${encodeURIComponent(ask.canvasId)}/history/${encodeURIComponent(ask.entryId)}/${ask.action}${query({ canvasId: ask.canvasId }, org)}`;
    return request<Record<string, unknown>>(path, token, method === 'GET' ? undefined : { method, body: JSON.stringify({ name: ask.name, keep: ask.keep, choices: ask.choices, confirm: ask.confirm }) });
  },
  resolve: (token: string, ask: ResolveAsk, org?: string) =>
    request<ResolveAnswer>(`/api/v1/canvas/${encodeURIComponent(ask.canvasId)}/conflicts/${encodeURIComponent(ask.conflictId)}/resolve${query({ canvasId: ask.canvasId }, org)}`, token, { method: 'POST', body: JSON.stringify({ keep: ask.keep }) })
};

export function historyRows(history: History) {
  return history.entries.map((e) => ({
    at: e.at,
    who: history.lanes[e.lane]?.label ?? '',
    what: e.kind,
    target: e.subject ?? e.frame_id ?? e.node_id ?? '',
    session: e.session_id ?? '',
    summary: e.summary ?? '',
    id: e.id
  }));
}
