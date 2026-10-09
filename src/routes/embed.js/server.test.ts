import { describe, expect, it } from 'vitest';
import { GET } from './+server';

describe('/embed.js', () => {
  it('serves the loader bound to the origin it is fetched from, with a short cache', async () => {
    const res = await GET({ url: new URL('https://oh.feega.app/embed.js') } as unknown as Parameters<typeof GET>[0]);
    const body = await res.text();

    expect(res.headers.get('content-type')).toContain('javascript');
    expect(res.headers.get('cache-control')).toContain('max-age=300');
    expect(body).toContain('"origin":"https://oh.feega.app"');
    expect(body).toContain('function loaderMain');
    expect(body).toContain('function hostMain');
  });
});
