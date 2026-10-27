import { request } from './api.ts';

export type AllowlistMedium = 'image' | 'video' | 'model3d';
export type ModelAllowlists = Record<AllowlistMedium, string[]>;

const PATH = '/api/v1/org/model-allowlist';

const withOrg = (path: string, org?: string) => (org ? `${path}?${new URLSearchParams({ org })}` : path);

export const modelAllowlistApi = {
  get: (token: string, org?: string) => request<ModelAllowlists>(withOrg(PATH, org), token),
  set: (token: string, body: { medium: AllowlistMedium; model_ids: string[] }, org?: string) =>
    request<{ medium: AllowlistMedium; model_ids: string[] }>(withOrg(PATH, org), token, { method: 'PUT', body: JSON.stringify(body) })
};
