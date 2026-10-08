import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_SUPABASE_URL: 'https://sb.test' } }));

const { GET } = await import('./+server');

const NODE = '6f1c2a8e-0b7d-4f1e-9a3c-2d5e8f7a1b40';

async function open(id: string, body: string | null) {
  const fetch = async () => (body === null ? new Response('', { status: 404 }) : new Response(body));
  return GET({ params: { id }, fetch } as unknown as Parameters<typeof GET>[0]);
}

describe('/e/[id]', () => {
  it('serves the published bundle as a page anyone can frame', async () => {
    const res = await open(NODE, '<html>clip</html>');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toBe('<html>clip</html>');
  });

  it('an unpublished embed is a 404', async () => {
    await expect(open(NODE, null)).rejects.toMatchObject({ status: 404 });
  });
});
