import { afterEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { unzipSync } from 'fflate';

vi.mock('$lib/server/dashboard/tool-scope', () => ({
  batchScope: vi.fn(async () => ({ db: {}, orgId: 'org', projectId: 'proj', userId: 'u', batch: { id: 'batch-1', name: 'Mugs' } }))
}));
vi.mock('$lib/server/repos/product-batches', async (original) => ({
  ...(await original<typeof import('$lib/server/repos/product-batches')>()),
  listItems: vi.fn(async () => [
    { id: 'i1', productIndex: 1, productTitle: 'Mug', environment: 'marble', shot: 'packshot', variation: 1, influencerId: null, status: 'done', approval: 'approved', assetId: 'a1' }
  ])
}));
vi.mock('$lib/server/studio/studio-media', () => ({
  signedAssets: vi.fn(async () => ({ assets: new Map([['a1', { mimeType: 'image/png' }]]), urls: { a1: 'https://signed/a1' } }))
}));

const { GET } = await import('./+server');

async function png(): Promise<ArrayBuffer> {
  const buf = await sharp({ create: { width: 300, height: 400, channels: 3, background: '#884422' } }).png().toBuffer();
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

function get(query: string) {
  return GET({ url: new URL(`http://x/app/studio/batch-1/zip${query}`), params: { batchId: 'batch-1' }, locals: {} } as never);
}

describe('zip of the picked photos', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('nel formato Amazon ogni foto esce 2000×2000 in JPG, con il canale nel nome', async () => {
    const body = await png();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body)));
    const res = await get('?format=amazon');
    const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
    const [name] = Object.keys(files);
    expect(name).toMatch(/amazon\.jpg$/);
    const meta = await sharp(files[name]).metadata();
    expect([meta.width, meta.height]).toEqual([2000, 2000]);
    expect(res.headers.get('content-disposition')).toContain('mugs-amazon.zip');
  });

  it('senza formato restano gli originali', async () => {
    const body = await png();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body)));
    const res = await get('');
    const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
    const meta = await sharp(Object.values(files)[0]).metadata();
    expect([meta.width, meta.height]).toEqual([300, 400]);
  });
});
