const UNAVAILABLE = 'unavailable';

export type CodeLanded = { nodes: unknown[]; undo: unknown[]; skipped: string[]; truncated: boolean; components: number; variants: number; instances: number };

export type CodeAsk = { projectId: string; canvasId: string; repo: string; route: string; at: { x: number; y: number } };

export async function importCode(ask: CodeAsk, fetchFn: typeof fetch = fetch): Promise<{ ok: true; landed: CodeLanded } | { ok: false; error: string; detail?: string }> {
  const res = await fetchFn(`/api/v1/projects/${ask.projectId}/code-import`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ canvasId: ask.canvasId, repo: ask.repo, route: ask.route, x: ask.at.x, y: ask.at.y })
  }).catch(() => null);
  if (!res?.ok) {
    const body = (await res?.json().catch(() => ({}))) as { error?: string; detail?: string } | undefined;
    return { ok: false, error: body?.error ?? UNAVAILABLE, ...(body?.detail ? { detail: body.detail } : {}) };
  }
  return { ok: true, landed: (await res.json()) as CodeLanded };
}
