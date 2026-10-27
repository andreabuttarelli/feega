import { describe, expect, it, vi } from 'vitest';
import { FigmaAsk, findFrames, importFrames } from './import-client';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe('asking the server for the frames of a Figma link', () => {
  it('posts the link and answers the frames with the preselected one', async () => {
    const fetchFn = vi.fn(async () => json(200, { frames: [{ id: '1:2', name: 'Hero', page: 'P', width: 1, height: 2 }], selected: '1:2' }));

    const got = await findFrames({ projectId: 'p1', url: 'https://www.figma.com/design/K/x' }, fetchFn);

    expect(got).toEqual({ ask: FigmaAsk.Done, frames: [{ id: '1:2', name: 'Hero', page: 'P', width: 1, height: 2 }], selected: '1:2' });
    expect(fetchFn).toHaveBeenCalledWith('/api/v1/projects/p1/figma/frames', expect.objectContaining({ method: 'POST' }));
  });

  it('tells apart a missing token from any other refusal', async () => {
    expect((await findFrames({ projectId: 'p1', url: 'x' }, async () => json(409, { error: 'no_token' }))).ask).toBe(FigmaAsk.NoToken);
    expect(await findFrames({ projectId: 'p1', url: 'x' }, async () => json(422, { error: 'token_rejected' }))).toEqual({ ask: FigmaAsk.Refused, error: 'token_rejected' });
  });

  it('reports an unreachable server as a refusal', async () => {
    expect(await findFrames({ projectId: 'p1', url: 'x' }, async () => Promise.reject(new Error('down')))).toEqual({ ask: FigmaAsk.Refused, error: 'unavailable' });
  });
});

describe('importing the chosen frames', () => {
  it('posts the choice and answers the nodes the server drew', async () => {
    const fetchFn = vi.fn(async () => json(200, { nodes: [{ id: 'n1' }], undo: [], skipped: ['a'] }));

    const got = await importFrames({ projectId: 'p1', canvasId: 'c1', url: 'u', frameIds: ['1:2'], at: { x: 3, y: 4 } }, fetchFn);

    expect(got).toEqual({ ask: FigmaAsk.Done, nodes: [{ id: 'n1' }], undo: [], skipped: ['a'] });
    expect(JSON.parse((fetchFn.mock.calls[0] as unknown as [string, { body: string }])[1].body)).toEqual({ canvasId: 'c1', url: 'u', frameIds: ['1:2'], x: 3, y: 4 });
  });

  it('answers the refusal the server gave', async () => {
    expect(await importFrames({ projectId: 'p1', canvasId: 'c1', url: 'u', frameIds: ['1:2'], at: { x: 0, y: 0 } }, async () => json(429, { error: 'rate_limited' }))).toEqual({ ask: FigmaAsk.Refused, error: 'rate_limited' });
  });
});
