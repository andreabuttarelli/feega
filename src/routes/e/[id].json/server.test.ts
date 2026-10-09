import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_SUPABASE_URL: 'https://sb.test' } }));

const { GET } = await import('./+server');

const NODE = '6f1c2a8e-0b7d-4f1e-9a3c-2d5e8f7a1b40';

function page(cfg: Record<string, unknown>) {
  return `<!doctype html><html><head><title>Saturn</title></head><body><script>(function playerMain(cfg){})(${JSON.stringify(cfg)});</script></body></html>`;
}

async function open(body: string | null) {
  const fetch = async () => (body === null ? new Response('', { status: 404 }) : new Response(body));
  return GET({ params: { id: NODE }, fetch } as unknown as Parameters<typeof GET>[0]);
}

describe('/e/[id].json', () => {
  it('tells the loader how the published video plays, readable from any site', async () => {
    const res = await open(page({ html: '<p/>', width: 1920, height: 1080, duration: 24, playback: 'scrub', loop: false, scrollLength: 6 }));

    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(await res.json()).toEqual({ width: 1920, height: 1080, playback: 'scrub', scrollLength: 6 });
  });

  it('gives an embed published before scroll length the default', async () => {
    const res = await open(page({ html: '<p/>', width: 1080, height: 1080, duration: 4, playback: 'autoplay', loop: true }));
    expect((await res.json()).scrollLength).toBe(3);
  });

  it('an unpublished embed is a 404', async () => {
    await expect(open(null)).rejects.toMatchObject({ status: 404 });
  });
});
