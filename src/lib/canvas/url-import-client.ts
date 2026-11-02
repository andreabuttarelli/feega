const UNAVAILABLE = 'unavailable';
const BUSY = 'busy';
const BUSY_RETRIES = 4;
const BUSY_DELAY_MS = 6_000;

export type UrlLanded = { nodes: unknown[]; undo: unknown[]; skipped: string[]; truncated: boolean };

export type ImportExtent = 'top' | 'full';

export type ImportResult = { ok: true; landed: UrlLanded } | { ok: false; error: string; detail?: string };

type ImportAsk = Parameters<typeof importPage>[0];

export async function importPage(ask: { projectId: string; canvasId: string; url: string; at: { x: number; y: number }; extent?: ImportExtent; sections?: boolean; tokens?: boolean; breakpoints?: boolean }, fetchFn: typeof fetch = fetch): Promise<ImportResult> {
  const res = await fetchFn(`/api/v1/projects/${ask.projectId}/url-import`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ canvasId: ask.canvasId, url: ask.url, x: ask.at.x, y: ask.at.y, ...(ask.extent ? { extent: ask.extent } : {}), ...(ask.sections === false ? { sections: false } : {}), ...(ask.tokens === false ? { tokens: false } : {}), ...(ask.breakpoints === false ? { breakpoints: false } : {}) })
  }).catch(() => null);
  if (!res?.ok) {
    const body = (await res?.json().catch(() => ({}))) as { error?: string; detail?: string } | undefined;
    return { ok: false, error: body?.error ?? UNAVAILABLE, ...(body?.detail ? { detail: body.detail } : {}) };
  }
  return { ok: true, landed: (await res.json()) as UrlLanded };
}

export async function importPageWaiting(ask: ImportAsk, ports: { fetchFn?: typeof fetch; sleep?: (ms: number) => Promise<void>; onBusy: () => void }): Promise<ImportResult> {
  const sleep = ports.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  for (let retry = 0; ; retry++) {
    const got = await importPage(ask, ports.fetchFn);
    if (got.ok || got.error !== BUSY || retry >= BUSY_RETRIES) {
      return got;
    }
    ports.onBusy();
    await sleep(BUSY_DELAY_MS);
  }
}
