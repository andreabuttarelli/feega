const UNAVAILABLE = 'unavailable';

export type UrlLanded = { nodes: unknown[]; undo: unknown[]; skipped: string[]; truncated: boolean };

export async function importPage(ask: { projectId: string; canvasId: string; url: string; at: { x: number; y: number } }, fetchFn: typeof fetch = fetch): Promise<{ ok: true; landed: UrlLanded } | { ok: false; error: string }> {
  const res = await fetchFn(`/api/v1/projects/${ask.projectId}/url-import`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ canvasId: ask.canvasId, url: ask.url, x: ask.at.x, y: ask.at.y })
  }).catch(() => null);
  if (!res?.ok) {
    const body = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
    return { ok: false, error: body?.error ?? UNAVAILABLE };
  }
  return { ok: true, landed: (await res.json()) as UrlLanded };
}
