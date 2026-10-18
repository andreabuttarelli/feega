import { request } from './api.ts';

export type OrgSummary = { id: string; name: string; slug: string; role: string; active: boolean };

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const orgsApi = {
  list: (token: string) => request<{ orgs: OrgSummary[] }>('/api/v1/orgs', token),
  create: (token: string, name: string) => request<{ org_id: string }>('/api/v1/orgs', token, json('POST', { name })),
  switch: (token: string, orgId: string) => request<{ outcome: string; org_id: string }>('/api/v1/orgs/active', token, json('PUT', { org_id: orgId }))
};

export type TeamOpBody = { op: string } & Record<string, unknown>;

const teamPath = (orgId: string) => `/api/v1/orgs/${encodeURIComponent(orgId)}/team`;

export async function activeOrgId(token: string, orgId?: string): Promise<string> {
  if (orgId) {
    return orgId;
  }
  const { orgs } = await orgsApi.list(token);
  const active = orgs.find((o) => o.active);
  if (!active) {
    throw new Error('No organisation. Run: feega orgs create <name>');
  }
  return active.id;
}

export const teamApi = {
  get: (token: string, orgId: string) => request<Record<string, unknown>>(teamPath(orgId), token),
  op: (token: string, orgId: string, body: TeamOpBody) => request<Record<string, unknown>>(teamPath(orgId), token, json('POST', body))
};
