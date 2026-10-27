import { describe, expect, it, vi } from 'vitest';
import { playEndpoint, requestPlayLink } from './play-link';

describe('playEndpoint', () => {
  it('points at the editor route of the frame', () => {
    expect(playEndpoint({ projectId: 'p1', canvasId: 'c1', nodeId: 'n1' })).toBe('/p/p1/c/c1/motion/n1/play');
  });
});

describe('requestPlayLink', () => {
  it('asks the server to share the prototype and returns the link', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ url: 'https://app.test/play/t?frame=n1' }), { status: 200 }));

    expect(await requestPlayLink(fetcher as never, '/p/p1/c/c1/motion/n1/play')).toBe('https://app.test/play/t?frame=n1');
    expect(fetcher).toHaveBeenCalledWith('/p/p1/c/c1/motion/n1/play', { method: 'POST' });
  });

  it('is null when the server refuses', async () => {
    const fetcher = async () => new Response('{}', { status: 409 });

    expect(await requestPlayLink(fetcher as never, '/x')).toBeNull();
  });

  it('is null when the request fails', async () => {
    const fetcher = async () => {
      throw new Error('offline');
    };

    expect(await requestPlayLink(fetcher as never, '/x')).toBeNull();
  });
});
