import { describe, it, expect } from 'vitest';
import { DEFAULT_REMOTE_RENDER_URL, FramesSource, fetchRemoteFrames, framesSource, remoteRenderUrl } from './frames-source';

describe('where a frame image is drawn', () => {
  it('here when the server renderer is open, whatever the remote is', () => {
    expect(framesSource({ open: true, remoteUrl: 'https://r.test', ownOrigin: 'http://localhost:5173' })).toBe(FramesSource.Local);
  });

  it('at the remote renderer when this server has none', () => {
    expect(framesSource({ open: false, remoteUrl: 'https://r.test', ownOrigin: 'http://localhost:5173' })).toBe(FramesSource.Remote);
  });

  it('closed when there is no remote, or the remote is this very server', () => {
    expect(framesSource({ open: false, remoteUrl: null, ownOrigin: 'http://localhost:5173' })).toBe(FramesSource.Closed);
    expect(framesSource({ open: false, remoteUrl: 'http://localhost:5173', ownOrigin: 'http://localhost:5173' })).toBe(FramesSource.Closed);
  });

  it('the remote defaults to the deployed app, can be changed, and can be turned off', () => {
    expect(remoteRenderUrl({})).toBe(DEFAULT_REMOTE_RENDER_URL);
    expect(remoteRenderUrl({ REMOTE_RENDER_URL: 'https://dev.test/' })).toBe('https://dev.test');
    expect(remoteRenderUrl({ REMOTE_RENDER_URL: 'off' })).toBeNull();
  });
});

describe('asking the remote renderer', () => {
  it('forwards the node, the times and the caller bearer, and returns its answer', async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const fetcher = (async (url: string, init: RequestInit) => (seen.push({ url, init }), new Response(JSON.stringify({ frames: [{ time: 0, mime: 'image/jpeg', data: 'AA' }] }), { status: 200 }))) as unknown as typeof fetch;

    const answer = await fetchRemoteFrames('https://r.test', { nodeId: 'n 1', times: [0, 1], width: 640, bearer: 'secret-token', org: 'o-1' }, fetcher);

    expect(answer).toEqual({ status: 200, body: { frames: [{ time: 0, mime: 'image/jpeg', data: 'AA' }] } });
    expect(seen[0].url).toBe('https://r.test/api/v1/motion/n%201/frames?org=o-1');
    expect((seen[0].init.headers as Record<string, string>).Authorization).toBe('Bearer secret-token');
    expect(JSON.parse(seen[0].init.body as string)).toEqual({ times: [0, 1], width: 640 });
  });

  it('an unreachable remote is an answer that says so, never the bearer', async () => {
    const fetcher = (async () => {
      throw new Error('connect ECONNREFUSED secret-token');
    }) as unknown as typeof fetch;

    const answer = await fetchRemoteFrames('https://r.test', { nodeId: 'n', times: [0], bearer: 'secret-token' }, fetcher);

    expect(answer.status).toBe(502);
    expect(JSON.stringify(answer.body)).not.toContain('secret-token');
    expect(answer.body).toMatchObject({ error: 'remote_render_unreachable' });
  });
});
