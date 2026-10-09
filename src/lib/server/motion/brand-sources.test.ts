import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }));
vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async (host: string) => [{ address: host === 'brand.example' ? '93.184.216.34' : '127.0.0.1', family: 4 }])
}));

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Tool } from 'ai';
import sharp from 'sharp';
import type { Db } from '$lib/server/db/client';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { createMotionTools, type MotionSession } from './motion-tools';
import { brandSources } from './brand-sources';
import type { MotionAsset } from './editor';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

const PAGE = `<!doctype html><html><head><title>Verde | Shoes that walk lighter</title>
<meta property="og:image" content="/og.png"><meta name="theme-color" content="#1A6B4F">
<link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet"></head>
<body><img class="logo" src="/logo.svg"><h1>Shoes that walk lighter</h1><img src="/hero.png"></body></html>`;
const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="120" height="40" fill="#0B3D2E"/></svg>';

let server: Server;
let origin: string;
const realFetch = globalThis.fetch;

beforeAll(async () => {
  const hero = await sharp({ create: { width: 1600, height: 900, channels: 3, background: '#1a6b4f' } }).png().toBuffer();
  const og = await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#f2c14e' } }).png().toBuffer();
  const files: Record<string, [string, string | Buffer]> = { '/': ['text/html', PAGE], '/logo.svg': ['image/svg+xml', LOGO], '/hero.png': ['image/png', hero], '/og.png': ['image/png', og] };
  server = createServer((req, res) => {
    const file = files[req.url ?? ''];
    res.writeHead(file ? 200 : 404, { 'content-type': file?.[0] ?? 'text/plain' });
    res.end(file?.[1] ?? 'missing');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  vi.stubGlobal('fetch', (input: URL | string, init?: RequestInit) => realFetch(String(input).replace('https://brand.example', origin), init));
});

afterAll(() => {
  vi.unstubAllGlobals();
  server.close();
});

function storageDb() {
  const stored = new Map<string, string>();
  const db = {
    storage: {
      from: () => ({
        upload: async (path: string, file: File) => {
          stored.set(path, file.type);
          return { error: null };
        },
        createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://signed/${path}` }, error: null })
      })
    },
    from: () => ({
      insert: (row: Record<string, unknown>) => ({
        select: () => ({ single: async () => ({ data: { ...row, id: `asset-${stored.size}`, content: null, duration_s: null, source_node_id: null, uncensored: false, created_at: '2026-10-05T00:00:00Z' }, error: null }) })
      })
    })
  };
  return { db: db as unknown as Db, stored };
}

describe('brand sources wired into the real motion tools, against a served page', () => {
  it('reads the site, imports its logo and hero, and puts them in the video', async () => {
    const { db, stored } = storageDb();
    const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
    const assets: MotionAsset[] = [];
    let n = 0;
    const tools = createMotionTools({ session, assets, newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn(), ...brandSources(db, { orgId: 'org1', projectId: 'proj1', canvasId: 'c1', brandId: null, screen: async () => ({ ok: true }), userId: 'u1' }) });
    const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });

    const read = (await run('analyze_site', { url: 'https://brand.example/' })) as { ok: boolean; site: { name: string; tagline: string; palette: string[]; fonts: unknown[]; logos: { url: string }[]; images: { url: string; width: number }[] } };
    expect(read.ok).toBe(true);
    expect(read.site).toMatchObject({ name: 'Verde', tagline: 'Shoes that walk lighter', fonts: [{ family: 'Inter', google: true }] });
    expect(read.site.palette.slice(0, 2)).toEqual(['#1A6B4F', '#0B3D2E']);
    expect(read.site.images.map((i) => [i.url, i.width])).toEqual([
      ['https://brand.example/og.png', 1200],
      ['https://brand.example/hero.png', 1600]
    ]);

    const logo = await run('import_asset', { url: read.site.logos[0].url, label: 'logo' });
    const hero = await run('import_asset', { url: read.site.images[1].url });
    expect(logo).toMatchObject({ ok: true, width: 120, height: 40 });
    expect(hero).toMatchObject({ ok: true, width: 1600, height: 900 });
    expect([...stored.values()]).toEqual(['image/svg+xml', 'image/png']);
    expect([...stored.keys()].every((p) => p.startsWith('org1/proj1/imports/'))).toBe(true);

    expect((await run('add_clip', { component: 'Logo3D', start: 0, duration: 3, props: { assetId: logo.asset_id } })).ok).toBe(true);
    expect((await run('add_clip', { component: 'Image', start: 3, duration: 3, props: { assetId: hero.asset_id } })).ok).toBe(true);
    expect(session.doc.assets.map((a) => a.id)).toEqual([logo.asset_id, hero.asset_id]);
  });

  it('imports a logo drawn inline in the page, which has no url of its own', async () => {
    const { db, stored } = storageDb();
    const sources = brandSources(db, { orgId: 'org1', projectId: 'proj1', canvasId: 'c1', brandId: null, screen: async () => ({ ok: true }), userId: 'u1' });
    vi.stubGlobal('fetch', async () => new Response('<html><body><a class="site-logo" href="/"><svg viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg></a></body></html>', { headers: { 'content-type': 'text/html' } }));

    const read = (await sources.site('https://brand.example/')) as { ok: true; site: { logos: { url: string; markup?: string }[] } };
    vi.stubGlobal('fetch', (input: URL | string, init?: RequestInit) => realFetch(String(input).replace('https://brand.example', origin), init));

    expect(read.site.logos[0]).toEqual({ url: 'https://brand.example/#inline-logo', kind: 'svg', source: 'inline-svg' });
    expect(await sources.importAsset(read.site.logos[0].url, 'logo')).toMatchObject({ ok: true });
    expect([...stored.values()]).toEqual(['image/svg+xml']);
  });

  it('still refuses a host that resolves to this machine', async () => {
    const { db } = storageDb();
    const sources = brandSources(db, { orgId: 'org1', projectId: 'proj1', canvasId: 'c1', brandId: null, screen: async () => ({ ok: true }), userId: 'u1' });

    expect(await sources.site(origin)).toMatchObject({ ok: false });
    expect(await sources.importAsset(`${origin}/hero.png`)).toMatchObject({ ok: false });
  });
});
