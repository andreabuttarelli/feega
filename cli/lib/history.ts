import { request } from './api.ts';

export type HistoryLane = { key: string; kind: string; label: string };

export type HistoryEntry = { id: string; source: string; kind: string; at: string; lane: number; node_id: string | null; frame_id: string | null; summary: string | null };

export type History = { canvas_id: string; lanes: HistoryLane[]; entries: HistoryEntry[] };

export type HistoryAsk = { canvasId: string; author?: string; frame?: string };

function query(ask: HistoryAsk, org?: string): string {
  const params = new URLSearchParams(Object.entries({ author: ask.author, frame: ask.frame, org }).flatMap(([k, v]) => (v ? [[k, v]] : [])));
  const text = params.toString();
  return text ? `?${text}` : '';
}

export const historyApi = {
  list: (token: string, ask: HistoryAsk, org?: string) => request<History>(`/api/v1/canvas/${encodeURIComponent(ask.canvasId)}/history${query(ask, org)}`, token)
};

export function historyRows(history: History) {
  return history.entries.map((e) => ({
    at: e.at,
    who: history.lanes[e.lane]?.label ?? '',
    what: e.kind,
    target: e.frame_id ?? e.node_id ?? '',
    summary: e.summary ?? '',
    id: e.id
  }));
}
