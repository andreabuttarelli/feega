import { describe, expect, it, vi } from 'vitest';
import { importPage } from './url-import-client';

const ASK = { projectId: 'p1', canvasId: 'c1', url: 'https://acme.test', at: { x: 1, y: 2 } };

describe('importPage', () => {
  it('chiama la route del progetto con canvas, url e punto', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ nodes: [{ id: 'f1' }], undo: [], skipped: [], truncated: false })));

    const got = await importPage(ASK, fetchFn as unknown as typeof fetch);

    expect(got).toEqual({ ok: true, landed: { nodes: [{ id: 'f1' }], undo: [], skipped: [], truncated: false } });
    expect(fetchFn).toHaveBeenCalledWith('/api/v1/projects/p1/url-import', expect.objectContaining({ body: JSON.stringify({ canvasId: 'c1', url: 'https://acme.test', x: 1, y: 2 }) }));
  });

  it('un rifiuto porta il suo codice', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ error: 'not_public' }), { status: 400 }));

    expect(await importPage(ASK, fetchFn as unknown as typeof fetch)).toEqual({ ok: false, error: 'not_public' });
  });

  it('can ask for the page as one tree, without sections', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ nodes: [], undo: [], skipped: [], truncated: false })));

    await importPage({ ...ASK, sections: false }, fetchFn as unknown as typeof fetch);

    expect(JSON.parse(String((fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toMatchObject({ sections: false });
  });

  it('can ask for raw values, without tokens', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ nodes: [], undo: [], skipped: [], truncated: false })));

    await importPage({ ...ASK, tokens: false }, fetchFn as unknown as typeof fetch);

    expect(JSON.parse(String((fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toMatchObject({ tokens: false });
  });

  it('can ask for the top of the page only', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ nodes: [], undo: [], skipped: [], truncated: true })));

    await importPage({ ...ASK, extent: 'top' }, fetchFn as unknown as typeof fetch);

    expect(JSON.parse(String((fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toMatchObject({ extent: 'top' });
  });
});
