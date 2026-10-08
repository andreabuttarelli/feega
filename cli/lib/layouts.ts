import { request } from './api.ts';

export type StoredLayout = { id: string; name: string; version: number; kind: 'spec'; spec: Record<string, unknown> };

const withOrg = (path: string, org?: string) => (org ? `${path}?${new URLSearchParams({ org })}` : path);

export const layoutsApi = {
  list: (token: string, org?: string) => request<{ layouts: StoredLayout[]; available: boolean }>(withOrg('/api/v1/org/layouts', org), token),
  write: (token: string, body: { name: string; spec: unknown }, org?: string) =>
    request<{ layout: StoredLayout }>(withOrg('/api/v1/org/layouts', org), token, { method: 'POST', body: JSON.stringify(body) }),
  patch: (token: string, layoutId: string, body: { version: number; spec: unknown }, org?: string) =>
    request<{ layout: StoredLayout }>(withOrg(`/api/v1/org/layouts/${encodeURIComponent(layoutId)}`, org), token, { method: 'PATCH', body: JSON.stringify(body) })
};
