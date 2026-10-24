import { request } from './api.ts';

export type CapScope = 'org_member' | 'project_member' | 'project_total';
export type CapReset = 'none' | 'monthly';
export type SpendCap = { scope: CapScope; project_id: string | null; cap_usd: number; reset: CapReset };
export type CapChange = { scope: CapScope; project_id?: string; cap_usd: number | null; reset?: CapReset };

const PATH = '/api/v1/org/spend-caps';

const withOrg = (path: string, org?: string) => (org ? `${path}?${new URLSearchParams({ org })}` : path);

export const spendCapsApi = {
  get: (token: string, org?: string) => request<{ caps: SpendCap[] }>(withOrg(PATH, org), token),
  set: (token: string, body: CapChange, org?: string) => request<SpendCap>(withOrg(PATH, org), token, { method: 'PUT', body: JSON.stringify(body) })
};
