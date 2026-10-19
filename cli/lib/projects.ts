import { request } from './api.ts';

export type ProjectList = { org: { id: string; name: string }; projects: { id: string; name: string; lastActiveAt: string }[] };
export type CanvasList = { project: { id: string; name: string }; canvases: { id: string; name: string; path: string }[] };

export const projectsApi = {
  list: (token: string, orgId?: string) => request<ProjectList>(`/api/v1/me/projects${orgId ? `?org=${encodeURIComponent(orgId)}` : ''}`, token),
  canvases: (token: string, projectId: string) => request<CanvasList>(`/api/v1/projects/${encodeURIComponent(projectId)}/canvases`, token)
};
