import { describe, expect, it, vi } from 'vitest';
import { KIT_AT, startPorts } from './start-client';

const SCOPE = { projectId: 'p1', canvasId: 'c1' };

function answering(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

describe('the start page talks to the same endpoints the CLI could', () => {
  it('creates the project', async () => {
    const fetchFn = answering(200, SCOPE);
    expect(await startPorts(fetchFn as unknown as typeof fetch).create('https://stripe.com/')).toEqual(SCOPE);
    expect(fetchFn).toHaveBeenCalledWith('/api/v1/start', expect.objectContaining({ body: JSON.stringify({ url: 'https://stripe.com/' }) }));
  });

  it('imports the top of the page', async () => {
    const fetchFn = answering(200, { nodes: [], undo: [], skipped: [], truncated: true });
    expect(await startPorts(fetchFn as unknown as typeof fetch).importPage(SCOPE, 'https://stripe.com/')).toBe(true);
    expect(JSON.parse(String((fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toMatchObject({ extent: 'top', canvasId: 'c1' });
  });

  it('asks for the brand next to the page; a refusal is a failed step', async () => {
    const ok = answering(200, { outcome: 'created' });
    expect(await startPorts(ok as unknown as typeof fetch).brand(SCOPE, 'https://stripe.com/')).toBe(true);
    expect(ok).toHaveBeenCalledWith('/api/v1/projects/p1/brand-from-site', expect.objectContaining({ body: JSON.stringify({ canvasId: 'c1', url: 'https://stripe.com/', ...KIT_AT }) }));

    expect(await startPorts(answering(502, { error: 'x' }) as unknown as typeof fetch).brand(SCOPE, 'https://stripe.com/')).toBe(false);
  });
});
