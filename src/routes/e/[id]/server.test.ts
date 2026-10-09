import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_SUPABASE_URL: 'https://sb.test' } }));

const { GET } = await import('./+server');

const NODE = '6f1c2a8e-0b7d-4f1e-9a3c-2d5e8f7a1b40';

async function open(id: string, body: string | null) {
  const fetch = async () => (body === null ? new Response('', { status: 404 }) : new Response(body));
  return GET({ params: { id }, fetch, url: new URL(`https://oh.feega.app/e/${id}`) } as unknown as Parameters<typeof GET>[0]);
}

describe('/e/[id]', () => {
  it('serves the published bundle as a page anyone can frame', async () => {
    const res = await open(NODE, '<html>clip</html>');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toBe('<html>clip</html>');
  });

  it('serves an embed published with an older player through the current one', async () => {
    const cfg = { html: '<p>clip</p>', width: 1920, height: 1080, duration: 24, playback: 'scrub', loop: false };
    const legacy = `<!doctype html><html><head><title>Saturn</title></head><body><script>(function playerMain(cfg){})(${JSON.stringify(cfg).replace(/</g, '\\u003c')});</script></body></html>`;

    const page = await (await open(NODE, legacy)).text();

    expect(page).toContain('<title>Saturn</title>');
    expect(page).toContain('function selfScroll');
    expect(page).toContain('\\u003cp>clip\\u003c/p>');
    expect(page).toContain('"standaloneMs":500');
  });

  it('points large inlined assets at cached urls instead of shipping them in the page', async () => {
    const audio = `data:audio/mpeg;base64,${Buffer.alloc(4096, 7).toString('base64')}`;

    const page = await (await open(NODE, `<html>${audio}</html>`)).text();

    expect(page).not.toContain('base64');
    expect(page).toMatch(new RegExp(`https://oh\\.feega\\.app/e/${NODE}/a/[0-9a-f]+`));
  });

  it('an unpublished embed is a 404', async () => {
    await expect(open(NODE, null)).rejects.toMatchObject({ status: 404 });
  });
});
