import { request } from './api.ts';

export type OrgSummary = { id: string; name: string; slug: string; role: string; active: boolean };

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const orgsApi = {
  list: (token: string) => request<{ orgs: OrgSummary[] }>('/api/v1/orgs', token),
  create: (token: string, name: string) => request<{ org_id: string }>('/api/v1/orgs', token, json('POST', { name })),
  switch: (token: string, orgId: string) => request<{ outcome: string; org_id: string }>('/api/v1/orgs/active', token, json('PUT', { org_id: orgId }))
};
