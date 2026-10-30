import { importPage } from '$lib/canvas/url-import-client';
import type { StartPorts, StartScope } from './start-steps';

export const PAGE_AT = { x: 0, y: 0 };
export const KIT_AT = { x: 880, y: -900 };

async function postJson<T>(fetchFn: typeof fetch, path: string, body: unknown): Promise<T | null> {
  const res = await fetchFn(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
  return res?.ok ? ((await res.json()) as T) : null;
}

export function startPorts(fetchFn: typeof fetch = fetch): StartPorts {
  return {
    create: (url) => postJson<StartScope>(fetchFn, '/api/v1/start', { url }),
    importPage: async (scope, url) => (await importPage({ ...scope, url, at: PAGE_AT, extent: 'top' }, fetchFn)).ok,
    brand: async (scope, url) => (await postJson(fetchFn, `/api/v1/projects/${scope.projectId}/brand-from-site`, { canvasId: scope.canvasId, url, ...KIT_AT })) !== null
  };
}
