import { request } from './api.ts';

export type EffectCheck = { state: 'unchecked' | 'passed' | 'failed'; problems: string[]; costMs: number | null };
export type CustomEffectRow = { effect_id: string; name: string; version: number; state: EffectCheck['state']; problems: string[]; cost_ms: number | null };
export type WrittenEffect = { effect: { id: string; name: string; version: number; check: EffectCheck } };
export type EffectDraft = { name: string; frag: string; params: unknown[] };
export type EffectPatch = { version: number; frag?: string; edits?: { find: string; replace: string }[]; params?: unknown[] };

const withOrg = (path: string, org?: string) => (org ? `${path}?${new URLSearchParams({ org })}` : path);

export const effectsApi = {
  list: (token: string, org?: string) => request<{ effects: { id: string; label: string }[]; custom: CustomEffectRow[] }>(withOrg('/api/v1/org/effects', org), token),
  write: (token: string, draft: EffectDraft, org?: string) =>
    request<WrittenEffect>(withOrg('/api/v1/org/custom-effects', org), token, { method: 'POST', body: JSON.stringify(draft) }),
  patch: (token: string, effectId: string, patch: EffectPatch, org?: string) =>
    request<WrittenEffect>(withOrg(`/api/v1/org/custom-effects/${encodeURIComponent(effectId)}`, org), token, { method: 'PATCH', body: JSON.stringify(patch) })
};
