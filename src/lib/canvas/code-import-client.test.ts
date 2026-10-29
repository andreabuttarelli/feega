import { describe, expect, it, vi } from 'vitest';
import { importCode } from './code-import-client';

const ASK = { projectId: 'p1', canvasId: 'c1', repo: 'https://github.com/a/b', route: '/x', at: { x: 1, y: 2 } };

describe('importCode', () => {
  it('chiama la route del progetto con canvas, repo, rotta e punto', async () => {
    const landed = { nodes: [{ id: 'f1' }], undo: [], skipped: [], truncated: false, components: 2, variants: 3, instances: 4 };
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(landed)));

    const got = await importCode(ASK, fetchFn as unknown as typeof fetch);

    expect(got).toEqual({ ok: true, landed });
    expect(fetchFn).toHaveBeenCalledWith('/api/v1/projects/p1/code-import', expect.objectContaining({ body: JSON.stringify({ canvasId: 'c1', repo: 'https://github.com/a/b', route: '/x', x: 1, y: 2 }) }));
  });

  it('un rifiuto porta il suo codice e il dettaglio', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ error: 'run_failed', detail: 'install_failed: x' }), { status: 422 }));

    expect(await importCode(ASK, fetchFn as unknown as typeof fetch)).toEqual({ ok: false, error: 'run_failed', detail: 'install_failed: x' });
  });
});
