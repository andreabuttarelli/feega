import { describe, expect, it, vi } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { embedSource } from '$lib/motion/interactive/bundle';

vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_SUPABASE_URL: 'https://sb.test' } }));

const { GET } = await import('./+server');

const NODE = '6f1c2a8e-0b7d-4f1e-9a3c-2d5e8f7a1b40';
const ORIGIN = 'https://app.test';
const PNG = new Uint8Array(4096).fill(7);

async function open(body: string | null) {
  const fetch = async () => (body === null ? new Response('', { status: 404 }) : new Response(body));
  return GET({ params: { id: NODE }, fetch, url: new URL(`${ORIGIN}/e/${NODE}/source.json`) } as unknown as Parameters<typeof GET>[0]);
}

describe('/e/[id]/source.json', () => {
  it('hands a host the doc to draw with gpu-core, assets served by the embed instead of inlined', async () => {
    const doc = newMotionDoc(MotionFormat.Square);
    const page = await embedSource({ doc, tokens: { ...FEEGA_TOKENS, logoUrl: 'https://x.test/logo.png' }, assetUrls: {}, title: 'Clip', fetchBlob: async () => new Blob([PNG], { type: 'image/png' }) });
    const res = await open(page);
    const body = await res.json();

    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(body.doc.width).toBe(doc.width);
    expect(body.tokens.logoUrl).toMatch(new RegExp(`^${ORIGIN}/e/${NODE}/a/[0-9a-f]{16}$`));
  });

  it('an unpublished embed is a 404', async () => {
    await expect(open(null)).rejects.toMatchObject({ status: 404 });
  });
});
