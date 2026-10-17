import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp, { type OverlayOptions } from 'sharp';
import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { test, expect, REAL_STACK, gotoHydrated, type E2eSession } from './fixtures/session';
import frameDoc from './fixtures/motion-doc.json' with { type: 'json' };

const OUT = process.env.GPU_PARITY_OUT ?? join(homedir(), 'Documents', 'feega-videos', 'webgpu-canvas', 'parity');
const RENDERERS = ['dom', 'webgpu', 'webgl'] as const;
const ONLY = process.env.GPU_PARITY_ONLY;
const ZOOMS = [0.35, 0.7, 1.2];
const COLUMNS = 6;
const STEP = { x: 620, y: 640 };
const MARGIN = 44;
const CELL = { w: 420, h: 320 };
const SETTLE_MS = 3500;
const SHOT_SETTLE_MS = 700;
const PICTURE = (seed: string) => `https://picsum.photos/seed/${seed}/400/400`;
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, lastRenderAssetId: null };

type Renderer = (typeof RENDERERS)[number];
type Seeded = { name: string; id: string };
type Assets = { poster: string; picture: string; clip: string; text: string };

const element = (component: string, props: Record<string, unknown>) => ({
  version: 5,
  fps: 30,
  width: 400,
  height: 400,
  durationInFrames: 150,
  background: 'transparent',
  still: { frame: 0 },
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: randomUUID().slice(0, 8), from: 0, durationInFrames: 150, component, props: { x: 0.5, y: 0.5, width: 1, height: 1, ...props } }] }],
  comps: {},
  assets: []
});

async function upload(admin: SupabaseClient, s: E2eSession, body: Buffer, type: string, mime: string, ext: string, content?: string): Promise<string> {
  const path = `${s.orgId}/${s.projectId}/${randomUUID()}.${ext}`;
  expect((await admin.storage.from('canvas-assets').upload(path, body, { contentType: mime })).error).toBeNull();
  const asset = await admin.from('assets').insert({ org_id: s.orgId, project_id: s.projectId, type, source: 'upload', url: path, mime_type: mime, ...(content ? { content } : {}) }).select('id').single();
  expect(asset.error).toBeNull();
  return asset.data!.id as string;
}

async function assets(admin: SupabaseClient, s: E2eSession): Promise<Assets> {
  const dir = mkdtempSync(join(tmpdir(), 'gpu-parity-'));
  const mp4 = join(dir, 'clip.mp4');
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=30:duration=3', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', mp4]);
  const photo = await sharp({ create: { width: 1024, height: 768, channels: 3, background: '#2b6cb0' } }).composite([{ input: Buffer.from('<svg width="1024" height="768"><circle cx="512" cy="384" r="250" fill="#f6ad55"/></svg>') }]).jpeg().toBuffer();
  const poster = await sharp({ create: { width: 1280, height: 720, channels: 3, background: '#111' } }).composite([{ input: Buffer.from('<svg width="1280" height="720"><text x="80" y="400" font-size="160" fill="#fff" font-family="Arial">poster</text></svg>') }]).jpeg().toBuffer();
  const text = 'Three hooks:\n1. Run the city at night.\n2. Lighter than your excuses.\n3. Made for wet asphalt.';
  return {
    poster: await upload(admin, s, poster, 'image', 'image/jpeg', 'jpg'),
    picture: await upload(admin, s, photo, 'image', 'image/jpeg', 'jpg'),
    clip: await upload(admin, s, readFileSync(mp4), 'video', 'video/mp4', 'mp4'),
    text: await upload(admin, s, Buffer.from(text), 'text', 'text/plain', 'txt', text)
  };
}

type Spec = { name: string; type: string; data: (a: Assets, influencer: string | null) => Record<string, unknown>; doc?: unknown; size?: { width: number; height: number } };

const SPECS: Spec[] = [
  { name: 'generate-text-empty', type: 'text', data: () => ({ prompt: '' }) },
  { name: 'generate-text-running', type: 'text', data: () => ({ prompt: 'Write three hooks', running: true }) },
  { name: 'generate-text-done', type: 'text', data: (a) => ({ prompt: 'Write three hooks', refId: a.text }) },
  { name: 'generate-text-failed', type: 'text', data: () => ({ prompt: 'Write three hooks', error: 'The model refused this prompt' }) },
  { name: 'generate-image-empty', type: 'image', data: () => ({ prompt: '' }) },
  { name: 'generate-image-running', type: 'image', data: () => ({ prompt: 'Orange sun on blue', running: true }) },
  { name: 'generate-image-done', type: 'image', data: (a) => ({ prompt: 'Orange sun on blue', refId: a.picture }) },
  { name: 'generate-image-failed', type: 'image', data: () => ({ prompt: 'Orange sun on blue', error: 'Generation failed' }) },
  { name: 'generate-video-empty', type: 'video', data: () => ({ prompt: '' }) },
  { name: 'generate-video-running', type: 'video', data: () => ({ prompt: 'Dolly in', running: true }) },
  { name: 'generate-video-done', type: 'video', data: (a) => ({ prompt: 'Dolly in', refId: a.clip }) },
  { name: 'generate-video-failed', type: 'video', data: () => ({ prompt: 'Dolly in', error: 'Generation failed' }) },
  { name: 'image-upload', type: 'image', data: (a) => ({ prompt: '', assetId: a.picture }) },
  { name: 'video-upload', type: 'video', data: (a) => ({ prompt: '', assetId: a.clip }) },
  { name: 'doc', type: 'doc', data: () => ({ content: '# Launch brief\n\nAudience: urban runners.\n\n- Hero film\n- Three cutdowns', public: false }) },
  { name: 'iframe', type: 'iframe', data: () => ({ url: 'https://example.com' }) },
  { name: 'audio', type: 'audio', data: () => ({ prompt: 'Upbeat 120bpm bed' }) },
  { name: 'calendar', type: 'calendar', data: () => ({ view: 'month', scope: 'canvas', anchor: '2026-10-01' }) },
  { name: 'ads', type: 'ads', data: () => ({ mode: 'search', search_terms: 'running shoes', country: 'IT' }) },
  { name: 'social-feed', type: 'social_account_feed', data: () => ({ platform: 'instagram', handle: 'nike' }) },
  { name: 'post-mockup', type: 'social_post_mockup', data: () => ({ general: { caption: 'New drop. Out now.', media: [] } }) },
  { name: 'products', type: 'products', data: () => ({ type: 'shopify', url: 'https://allbirds.com' }) },
  { name: 'influencer', type: 'influencer', data: (_a, influencer) => ({ influencer_id: influencer }) },
  { name: 'studio-batch', type: 'studio_batch', data: () => ({}) },
  { name: 'list', type: 'list', data: () => ({ itemKind: 'text', items: [{ text: 'one' }, { text: 'two' }] }) },
  { name: 'frame-poster', type: 'motion', data: (a) => ({ ...LANDSCAPE, posterAssetId: a.poster }), doc: frameDoc },
  { name: 'frame-no-poster', type: 'motion', data: () => ({ ...LANDSCAPE, posterAssetId: null }), doc: frameDoc },
  { name: 'free-box', size: { width: 240, height: 240 }, type: 'motion', data: () => ({ ...LANDSCAPE, kind: 'element', posterAssetId: null }), doc: element('Shape', { shape: 'rect', color: '#e53e3e' }) },
  { name: 'free-ellipse', size: { width: 240, height: 240 }, type: 'motion', data: () => ({ ...LANDSCAPE, kind: 'element', posterAssetId: null }), doc: element('Shape', { shape: 'ellipse', color: '#38a169' }) },
  { name: 'free-path', size: { width: 240, height: 240 }, type: 'motion', data: () => ({ ...LANDSCAPE, kind: 'element', posterAssetId: null }), doc: element('Shape', { shape: 'path', path: 'M0 1 L0.5 0 L1 1 Z', color: '#3182ce' }) },
  { name: 'free-text', size: { width: 320, height: 120 }, type: 'motion', data: () => ({ ...LANDSCAPE, kind: 'element', posterAssetId: null }), doc: element('Text', { text: 'Hello', color: '#111111', fontSize: 120 }) }
];

async function seed(admin: SupabaseClient, s: E2eSession): Promise<Seeded[]> {
  const a = await assets(admin, s);
  const influencer = ((await admin.from('influencers').select('id').is('org_id', null).limit(1)).data ?? [])[0]?.id ?? null;
  const rows = SPECS.filter((spec) => spec.type !== 'influencer' || influencer).map((spec, i) => ({
    spec,
    row: { id: randomUUID(), org_id: s.orgId, project_id: s.projectId, canvas_id: s.canvasId, type: spec.type, x: (i % COLUMNS) * STEP.x, y: Math.floor(i / COLUMNS) * STEP.y, data: spec.data(a, influencer), width: spec.size?.width ?? null, height: spec.size?.height ?? null, actor_kind: 'user', actor_id: s.userId }
  }));
  expect((await admin.from('nodes').insert(rows.map((r) => r.row))).error).toBeNull();
  for (const { spec, row } of rows.filter((r) => r.spec.doc)) {
    expect((await admin.from('motion_revisions').insert({ org_id: s.orgId, node_id: row.id, version: 1, doc: spec.doc, actor_kind: 'user', actor_id: s.userId })).error).toBeNull();
  }
  const id = (name: string) => rows.find((r) => r.spec.name === name)!.row.id;
  const feed = id('social-feed');
  const posts = Array.from({ length: 6 }, (_, i) => ({ org_id: s.orgId, project_id: s.projectId, node_id: feed, platform: 'instagram', external_id: `p${i}`, caption: `post ${i}`, media: i % 2 ? { type: 'video', thumbnailUrl: PICTURE(`v${i}`) } : { type: 'image', thumbnailUrl: PICTURE(`i${i}`) } }));
  expect((await admin.from('social_posts').insert(posts)).error).toBeNull();
  const products = Array.from({ length: 6 }, (_, i) => ({ org_id: s.orgId, project_id: s.projectId, node_id: id('products'), platform: 'shopify', external_id: `x${i}`, title: `Shoe ${i}`, price: 99 + i, currency: 'EUR', images: [{ url: PICTURE(`s${i}`) }] }));
  expect((await admin.from('products').insert(products)).error).toBeNull();
  const wire = (source: string, target: string, extra: Record<string, unknown>) => ({ org_id: s.orgId, canvas_id: s.canvasId, source_node_id: id(source), target_node_id: id(target), actor_kind: 'user', actor_id: s.userId, mode: 'fixed', source_handle: null, target_handle: null, ...extra });
  expect(
    (
      await admin.from('nodes_connections').insert([
        wire('generate-text-done', 'generate-image-done', { target_handle: 'text' }),
        wire('list', 'generate-image-empty', { target_handle: 'text', mode: 'iterate' }),
        wire('social-feed', 'generate-video-empty', { source_handle: 'out:images', target_handle: 'images' })
      ])
    ).error
  ).toBeNull();
  return rows.map((r) => ({ name: r.spec.name, id: r.row.id }));
}

async function zoomOf(page: Page): Promise<number> {
  return page.locator('.svelte-flow__viewport').first().evaluate((el) => Number(/scale\(([\d.]+)\)/.exec(el.getAttribute('style') ?? '')?.[1] ?? 1));
}

async function zoomTo(page: Page, target: number) {
  const pane = (await page.locator('.svelte-flow').first().boundingBox())!;
  await page.mouse.move(pane.x + 8, pane.y + pane.height - 8);
  await page.keyboard.down('Control');
  for (let i = 0; i < 300; i++) {
    const z = await zoomOf(page);
    if (Math.abs(z - target) / target < 0.04) {
      break;
    }
    await page.mouse.wheel(0, z < target ? -4 : 4);
  }
  await page.keyboard.up('Control');
}

async function centre(page: Page, id: string) {
  const pane = (await page.locator('.svelte-flow').first().boundingBox())!;
  const node = page.locator(`.svelte-flow__node[data-id="${id}"]`).first();
  let k = 0.5;
  let last = Infinity;
  for (let i = 0; i < 40; i++) {
    const b = (await node.boundingBox())!;
    const dx = pane.x + pane.width / 2 - (b.x + b.width / 2);
    const dy = pane.y + pane.height / 2 - (b.y + b.height / 2);
    const off = Math.hypot(dx, dy);
    if (off < 12) {
      return;
    }
    if (off >= last) {
      k /= 2;
    }
    last = off;
    await page.mouse.move(pane.x + 8, pane.y + pane.height - 8);
    await page.mouse.wheel(-dx * k, -dy * k);
    await page.waitForTimeout(60);
  }
}

async function shoot(page: Page, id: string, path: string) {
  await page.waitForTimeout(SHOT_SETTLE_MS);
  await expect
    .poll(() => page.locator(`.svelte-flow__node[data-id="${id}"] img`).evaluateAll((imgs) => imgs.every((i) => (i as HTMLImageElement).complete)), { timeout: 10_000 })
    .toBe(true)
    .catch(() => undefined);
  await expect.poll(() => page.evaluate(() => (window as { __gpuCanvas?: { pending?: number } }).__gpuCanvas?.pending ?? 0), { timeout: 10_000 }).toBe(0).catch(() => undefined);
  const pane = (await page.locator('.svelte-flow').first().boundingBox())!;
  const b = (await page.locator(`.svelte-flow__node[data-id="${id}"]`).first().boundingBox())!;
  const x = Math.max(pane.x, b.x - MARGIN);
  const y = Math.max(pane.y, b.y - MARGIN);
  const w = Math.min(pane.x + pane.width, b.x + b.width + MARGIN) - x;
  const h = Math.min(pane.y + pane.height, b.y + b.height + MARGIN) - y;
  if (w < 4 || h < 4) {
    await sharp({ create: { width: 40, height: 40, channels: 3, background: '#f0f' } }).png().toFile(path);
    return;
  }
  await page.screenshot({ path, clip: { x, y, width: w, height: h } });
}

async function sheet(name: string, cells: string[][]) {
  const label = (text: string, w: number) => Buffer.from(`<svg width="${w}" height="28"><rect width="100%" height="100%" fill="#222"/><text x="8" y="19" font-size="15" font-family="Arial" fill="#fff">${text}</text></svg>`);
  const width = RENDERERS.length * CELL.w;
  const height = 28 + ZOOMS.length * (CELL.h + 28);
  const parts: OverlayOptions[] = [{ input: label(name, width), left: 0, top: 0 }];
  for (const [r, row] of cells.entries()) {
    for (const [c, file] of row.entries()) {
      const top = 28 + r * (CELL.h + 28);
      parts.push({ input: label(`${RENDERERS[c]} · zoom ${ZOOMS[r]}`, CELL.w), left: c * CELL.w, top });
      parts.push({ input: await sharp(file).resize(CELL.w - 8, CELL.h - 8, { fit: 'contain', background: '#ebebeb' }).png().toBuffer(), left: c * CELL.w + 4, top: top + 28 + 4 });
    }
  }
  await sharp({ create: { width, height, channels: 3, background: '#ebebeb' } }).composite(parts).png().toFile(join(OUT, `${name}.png`));
}

test.describe('every node type looks the same on DOM, WebGPU and WebGL @parity @real', () => {
  test.skip(!REAL_STACK || !process.env.E2E_GPU_PARITY, 'E2E_REAL_STACK=1 E2E_GPU_PARITY=1');
  test.setTimeout(3_600_000);
  test.use({ viewport: { width: 1600, height: 1000 } });

  test('contact sheets', async ({ page, session, admin }) => {
    const nodes = await seed(admin, session);
    const raw = join(OUT, 'raw');
    mkdirSync(raw, { recursive: true });
    for (const renderer of RENDERERS.filter((r) => !ONLY || r === ONLY)) {
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}?renderer=${renderer}`);
      await expect(page.locator('.svelte-flow__node').first()).toBeVisible({ timeout: 60_000 });
      await page.waitForTimeout(SETTLE_MS);
      for (const zoom of ZOOMS) {
        await zoomTo(page, zoom);
        for (const n of nodes) {
          await centre(page, n.id);
          await shoot(page, n.id, join(raw, `${n.name}-${renderer}-${zoom}.png`));
        }
      }
    }
    const broken: string[] = [];
    for (const n of nodes) {
      for (const r of RENDERERS.filter((x) => !ONLY || x === ONLY)) {
        for (const z of ZOOMS) {
          const stats = await sharp(join(raw, `${n.name}-${r}-${z}.png`)).stats();
          const flat = stats.channels.every((c) => c.stdev < 2);
          if (flat) {
            broken.push(`${n.name}-${r}-${z}`);
          }
        }
      }
    }
    for (const n of ONLY ? [] : nodes) {
      await sheet(n.name, ZOOMS.map((z) => RENDERERS.map((r) => join(raw, `${n.name}-${r}-${z}.png`))));
    }
    writeFileSync(join(OUT, 'index.json'), JSON.stringify({ nodes: nodes.map((n) => n.name), broken }));
    expect(broken, 'every cell shows the node, never a placeholder or a flat colour').toEqual([]);
  });
});
