import { request } from './api.ts';

export type StudioQuote = { count: number; overLimit: boolean; perImage: number; total: number; droppedRefs: number; skipped: string[]; quoteId: string };

const inProject = (path: string, project?: string) => (project ? `${path}?${new URLSearchParams({ project })}` : path);

const post = (path: string, token: string, body: unknown) => request<unknown>(path, token, { method: 'POST', body: JSON.stringify(body) });

export type BatchAction = 'run' | 'more' | 'cancel' | 'retry' | 'regenerate' | 'approve' | 'reject';

export const studioApi = {
  quote: (token: string, selection: unknown, project?: string) => post(inProject('/api/v1/studio/quote', project), token, { selection }) as Promise<StudioQuote>,
  start: (token: string, selection: unknown, quoteId: string, project?: string) =>
    post(inProject('/api/v1/studio/start', project), token, { selection, quoteId }) as Promise<{ batchId: string }>,
  act: (token: string, batchId: string, action: BatchAction, body: { itemIds?: string[]; variations?: number } = {}) =>
    post(`/api/v1/studio/${encodeURIComponent(batchId)}?${new URLSearchParams({ action })}`, token, body),
  status: (token: string, batchId: string) => request<unknown>(`/api/v1/studio/${encodeURIComponent(batchId)}`, token)
};
