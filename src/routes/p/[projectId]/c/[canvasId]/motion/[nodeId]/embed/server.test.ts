import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_SUPABASE_URL: 'https://sb.test' } }));

const bucket = vi.hoisted(() => ({
  createSignedUploadUrl: vi.fn(async () => ({ data: { signedUrl: 'https://sb.test/upload?token=t' }, error: null })),
  remove: vi.fn(async () => ({ error: null })),
  list: vi.fn(async () => ({ data: [], error: null }))
}));

vi.mock('$lib/server/motion/editor-scope', () => ({
  motionScope: async () => ({ db: { storage: { from: () => bucket } }, motion: { record: { id: 'n-1' } } })
}));

const { GET, POST, DELETE } = await import('./+server');

const event = (method: string) => ({ locals: {}, params: { projectId: 'p', canvasId: 'c', nodeId: 'n-1' }, url: new URL(`http://localhost:5173/p/p/c/c/motion/n-1/embed`), request: new Request('http://localhost', { method }) }) as never;

describe('motion embed endpoint', () => {
  it('POST hands the editor a signed slot and the public url', async () => {
    const body = await (await POST(event('POST'))).json();

    expect(body).toMatchObject({ ok: true, url: 'http://localhost:5173/e/n-1', upload: { url: 'https://sb.test/upload?token=t' } });
    expect(bucket.createSignedUploadUrl).toHaveBeenCalledWith('n-1.html', { upsert: true });
  });

  it('GET says whether it is published, DELETE removes it', async () => {
    expect(await (await GET(event('GET'))).json()).toEqual({ published: false, url: 'http://localhost:5173/e/n-1' });
    expect(await (await DELETE(event('DELETE'))).json()).toEqual({ ok: true });
    expect(bucket.remove).toHaveBeenCalledWith(['n-1.html']);
  });
});
