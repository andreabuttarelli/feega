import { request } from './api.ts';

export type CloudProviderId = 'google_drive' | 'dropbox';
export type CloudStatus = { provider: CloudProviderId; label: string; connected: boolean; configured: boolean };
export type CloudEntry = { id: string; name: string; folder: boolean; mime: string | null; importable: boolean };
export type CloudPlace = { canvasId: string; x: number; y: number };

const base = (projectId: string) => `/api/v1/projects/${encodeURIComponent(projectId)}`;
const cloud = (projectId: string, provider: CloudProviderId) => `${base(projectId)}/cloud/${provider}`;

export const cloudApi = {
  providers: (token: string, projectId: string) => request<{ providers: CloudStatus[] }>(`${base(projectId)}/cloud`, token),
  files: (token: string, projectId: string, provider: CloudProviderId, page: { folder?: string; cursor?: string } = {}) => {
    const query = new URLSearchParams();
    if (page.folder) {
      query.set('folder', page.folder);
    }
    if (page.cursor) {
      query.set('cursor', page.cursor);
    }
    const suffix = query.size ? `?${query}` : '';
    return request<{ entries: CloudEntry[]; next: string | null }>(`${cloud(projectId, provider)}/files${suffix}`, token);
  },
  importFile: (token: string, projectId: string, provider: CloudProviderId, body: { fileId: string; place?: CloudPlace }) =>
    request<{ asset: { id: string }; node: unknown }>(`${cloud(projectId, provider)}/import`, token, { method: 'POST', body: JSON.stringify(body) }),
  exportAsset: (token: string, projectId: string, provider: CloudProviderId, body: { assetId: string; folder: string; name?: string }) =>
    request<{ exported: true }>(`${cloud(projectId, provider)}/export`, token, { method: 'POST', body: JSON.stringify(body) }),
  disconnect: (token: string, projectId: string, provider: CloudProviderId) =>
    request<{ disconnected: true; revoked: boolean }>(cloud(projectId, provider), token, { method: 'DELETE' })
};

export const figmaTokenApi = {
  status: (token: string, projectId: string) => request<{ connected: boolean }>(`${base(projectId)}/figma-token`, token)
};
