import { request } from './api.ts';

export type AppAccount = { loginUrl: string; email: string; sessionUntil: number | null };

const path = (projectId: string) => `/api/v1/projects/${encodeURIComponent(projectId)}/app-account`;

export type TestAccountInput = { login_url: string; email: string; password: string };

export const appAccountApi = {
  set: (token: string, projectId: string, account: TestAccountInput) => request<{ account: AppAccount | null }>(path(projectId), token, { method: 'PUT', body: JSON.stringify(account) }),
  get: (token: string, projectId: string) => request<{ account: AppAccount | null }>(path(projectId), token),
  forget: (token: string, projectId: string) => request<{ ok: true }>(path(projectId), token, { method: 'DELETE' })
};
