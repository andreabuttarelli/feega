import { describe, expect, it, vi } from 'vitest';
import { importPage, importPageWaiting } from './url-import-client';

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

  it('can ask for the desktop width only, without breakpoints', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ nodes: [], undo: [], skipped: [], truncated: false })));

    await importPage({ ...ASK, breakpoints: false }, fetchFn as unknown as typeof fetch);

    expect(JSON.parse(String((fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toMatchObject({ breakpoints: false });
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

describe('a refusal that explains itself', () => {
  it('carries the detail the server gave', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ error: 'rejected', detail: 'tracks.0: expected array' }), { status: 422 }));

    expect(await importPage(ASK, fetchFn as unknown as typeof fetch)).toEqual({ ok: false, error: 'rejected', detail: 'tracks.0: expected array' });
  });
});

describe('importPageWaiting', () => {
  const BUSY = () => new Response(JSON.stringify({ error: 'busy' }), { status: 503 });
  const LANDED = () => new Response(JSON.stringify({ nodes: [{ id: 'f1' }], undo: [], skipped: [], truncated: false }));

  it('when the browsers are all busy it says so, waits, and asks again until the page comes in', async () => {
    const fetchFn = vi.fn().mockImplementationOnce(async () => BUSY()).mockImplementationOnce(async () => BUSY()).mockImplementationOnce(async () => LANDED());
    const sleep = vi.fn(async () => undefined);
    const onBusy = vi.fn();

    const got = await importPageWaiting(ASK, { fetchFn: fetchFn as unknown as typeof fetch, sleep, onBusy });

    expect(got.ok).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(onBusy).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('gives up with busy after a few tries instead of waiting for ever', async () => {
    const fetchFn = vi.fn(async () => BUSY());

    const got = await importPageWaiting(ASK, { fetchFn: fetchFn as unknown as typeof fetch, sleep: async () => undefined, onBusy: () => undefined });

    expect(got).toEqual({ ok: false, error: 'busy' });
    expect(fetchFn.mock.calls.length).toBeGreaterThan(2);
    expect(fetchFn.mock.calls.length).toBeLessThan(10);
  });

  it('does not retry what a retry cannot fix', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ error: 'not_public' }), { status: 400 }));

    await importPageWaiting(ASK, { fetchFn: fetchFn as unknown as typeof fetch, sleep: async () => undefined, onBusy: () => undefined });

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
