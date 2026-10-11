import { request } from './api.ts';

export type AppAccount = { loginUrl: string; email: string; sessionUntil: number | null };

const path = (projectId: string) => `/api/v1/projects/${encodeURIComponent(projectId)}/app-account`;

export const appAccountApi = {
  get: (token: string, projectId: string) => request<{ account: AppAccount | null }>(path(projectId), token),
  forget: (token: string, projectId: string) => request<{ ok: true }>(path(projectId), token, { method: 'DELETE' })
};
