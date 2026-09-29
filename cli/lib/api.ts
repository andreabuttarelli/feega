/**
 * Thin HTTP client for the feega CLI.
 * No Supabase, no DB access, no secrets — just HTTP calls to the feega API.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { appUrl } from './config.ts';
import {
  pathFor,
  pathWithoutBrand,
  TOOL_HEADER,
  type BrandEndpoint,
  type ResourceEndpoint,
  type ResourcelessEndpoint,
} from './contracts/index.ts';

/**
 * Quale tool sta chiamando, per le richieste che partono da qui dentro. Un comando della CLI non
 * ne apre nessuno: l'intestazione parte solo quando c'è davvero un tool, e il server non si trova
 * ad attribuire una spesa a un tool che nessuno ha chiamato.
 */
const toolCall = new AsyncLocalStorage<string>();

export function asTool<T>(tool: string, fn: () => T): T {
  return toolCall.run(tool, fn);
}

export async function request<T>(path: string, token: string, opts?: RequestInit): Promise<T> {
  // Resolved per call, not at import time: loadEnv() sets PUBLIC_APP_URL after the module
  // graph is already loaded, so a module-level constant would freeze the production default
  // and ignore the local dev server.
  const url = `${appUrl()}${path}`;
  const tool = toolCall.getStore();
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(tool ? { [TOOL_HEADER]: tool } : {}),
      ...opts?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

function get<T>(path: string, token: string): Promise<T> {
  return request<T>(path, token);
}

function post<T>(path: string, token: string, body?: unknown): Promise<T> {
  return request<T>(path, token, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Nessuno slug: si va per la strada senza brand, se il registro ne dichiara una. Se non la
 * dichiara è un errore qui e subito — cadere sulla rotta del brand costruirebbe `/brands//…`, che
 * il server rifiuterebbe con un 404 illeggibile molto più tardi.
 */
function brandFreeCall(endpoint: BrandEndpoint, slug: string | null): string | null {
  if (slug) return null;

  const path = pathWithoutBrand(endpoint);
  if (!path) throw new Error(`${endpoint.tool} needs a brand slug`);

  return path;
}

export function callEndpoint<T>(
  endpoint: ResourcelessEndpoint,
  token: string,
  slug: string | null,
  input?: Record<string, unknown>,
): Promise<T>;
export function callEndpoint<T>(
  endpoint: ResourceEndpoint,
  token: string,
  slug: string,
  input: Record<string, unknown>,
  id: string,
): Promise<T>;
export function callEndpoint<T>(
  endpoint: BrandEndpoint,
  token: string,
  slug: string | null,
  input: Record<string, unknown> = {},
  id?: string,
): Promise<T> {
  const path = brandFreeCall(endpoint, slug)
    ?? (endpoint.resource === undefined ? pathFor(endpoint, slug!) : pathFor(endpoint, slug!, id ?? ''));
  if (endpoint.method === 'DELETE') return request<T>(path, token, { method: 'DELETE' });
  if (endpoint.method !== 'GET') {
    return request<T>(path, token, { method: endpoint.method, body: JSON.stringify(input) });
  }

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== null) query.set(key, String(value));
  }
  const qs = query.toString();
  return get<T>(qs ? `${path}?${qs}` : path, token);
}

// ── Types ───────────────────────────────────────────────────────────────

export type BrandSummary = {
  id: string;
  name: string;
  slug: string;
  pendingCount: number;
};

export type AdCampaignSummary = {
  id: string;
  name: string;
  objective: string;
  budgetType: string;
  budgetAmount: number;
  status: string;
  approvedAt: string | null;
};

export type BrandDetail = {
  brand: BrandSummary;
  pendingCount: number;
  productCount: number;
  accountCount: number;
  logoUrl: string | null;
};

export type MediaItem = {
  assetId: string;
  nodeId: string | null;
  runId: string | null;
  type: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  durationS: number | null;
  bytes: number | null;
  fullUrl: string | null;
  previewUrl: string | null;
  text: string | null;
};

export type Media = { items: MediaItem[]; missing: string[] };

export type MediaQuery = { node?: string[]; run?: string[]; asset?: string[]; org?: string };

function mediaPath(q: MediaQuery): string {
  const qs = new URLSearchParams();
  for (const key of ['node', 'run', 'asset'] as const) {
    if (q[key]?.length) {
      qs.set(key, q[key]!.join(','));
    }
  }
  if (q.org) {
    qs.set('org', q.org);
  }
  return `/api/v1/org/media?${qs}`;
}

// ── API methods ─────────────────────────────────────────────────────────

export const api = {
  // Brands
  listBrands: (t: string) => get<BrandSummary[]>('/api/v1/brands', t),
  getBrand: (t: string, slug: string) => get<BrandDetail>(`/api/v1/brands/${slug}`, t),

  // ── Products ──────────────────────────────────────────────────────────
  listProducts: (t: string, slug: string) =>
    get<{ products: { id: string; title: string; kind: string; pricing: string | null; imageCount: number; featured: boolean }[] }>(`/api/v1/brands/${slug}/products`, t),

  syncProducts: (t: string, slug: string) =>
    post<{
      ok: boolean;
      platform: string;
      synced: number;
      rejected: { title: string; reason: string }[];
    }>(`/api/v1/brands/${slug}/products`, t),

  // ── Ads ───────────────────────────────────────────────────────────────

  listAdCampaigns: (t: string, brandId: string) =>
    get<{ campaigns: AdCampaignSummary[] }>(`/api/v1/org/ads/campaigns?brand_id=${encodeURIComponent(brandId)}`, t),

  approveAdCampaign: (t: string, id: string) =>
    post<{ campaign?: AdCampaignSummary; error?: string; message?: string }>(
      `/api/v1/org/ads/campaigns/${encodeURIComponent(id)}/approve`,
      t
    ),

  setAdCampaignStatus: (t: string, id: string, next: 'active' | 'paused') =>
    post<{ ok: boolean; error?: string; detail?: string }>(
      `/api/v1/org/ads/campaigns/${encodeURIComponent(id)}/status`,
      t,
      { next }
    ),

  getMedia: (t: string, q: MediaQuery) => get<Media>(mediaPath(q), t),

};
