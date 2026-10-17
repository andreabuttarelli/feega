import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { test, expect, REAL_STACK, skipTour, type E2eSession } from './fixtures/session';
import plainDoc from './fixtures/motion-doc.json' with { type: 'json' };
import { dragFrom, instrument, measure, wheelPan, wheelZoom, type Frames } from './fixtures/frame-sweeps';
import { CONSENT_COOKIE, CONSENT_VERSION, encodeConsent } from '../../src/lib/consent-model';

const COUNTS = (process.env.GPU_COMPARE_NODES ?? '15,200').split(',').map(Number);
const RENDERERS = (process.env.GPU_COMPARE_RENDERERS ?? 'dom,webgpu,webgl').split(',');
const OUT = process.env.GPU_COMPARE_OUT ?? join(homedir(), 'Documents', 'feega-videos', 'webgpu-canvas');
const DESKTOP = { width: 1440, height: 900 };
const SETTLE_MS = 4000;
const SWEEP_MS = 5000;
const COLUMNS = 5;
const STEP = { x: 560, y: 520 };
const KINDS = ['motion', 'image-upload', 'text', 'image', 'video-upload', 'doc', 'social_account_feed', 'products', 'iframe', 'video', 'motion', 'calendar', 'motion', 'list', 'audio'] as const;

type Kind = (typeof KINDS)[number];
type Assets = { poster: string; picture: string; clip: string };
type Run = { renderer: string; nodes: number; backend: string; pan: Frames; zoom: Frames; drag: Frames; heapMb: number; domNodes: number };

const consent = {
  cookies: [{ name: CONSENT_COOKIE, value: encodeConsent({ version: CONSENT_VERSION, at: 0, analytics: false, marketing: false }), domain: 'localhost', path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' as const }],
  origins: []
};

async function upload(admin: SupabaseClient, s: E2eSession, body: Buffer, type: 'image' | 'video', mime: string, ext: string): Promise<string> {
  const path = `${s.orgId}/${s.projectId}/${randomUUID()}.${ext}`;
  expect((await admin.storage.from('canvas-assets').upload(path, body, { contentType: mime })).error).toBeNull();
  const asset = await admin.from('assets').insert({ org_id: s.orgId, project_id: s.projectId, type, source: 'upload', url: path, mime_type: mime }).select('id').single();
  expect(asset.error).toBeNull();
  return asset.data!.id as string;
}

async function assets(admin: SupabaseClient, s: E2eSession): Promise<Assets> {
  const noisy = (w: number, h: number, mean: number) => sharp({ create: { width: w, height: h, channels: 3, background: '#000', noise: { type: 'gaussian', mean, sigma: 40 } } }).jpeg().toBuffer();
  const dir = mkdtempSync(join(tmpdir(), 'gpu-compare-'));
  const mp4 = join(dir, 'clip.mp4');
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=30:duration=4', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', mp4]);
  return {
    poster: await upload(admin, s, await noisy(1280, 720, 90), 'image', 'image/jpeg', 'jpg'),
    picture: await upload(admin, s, await noisy(1024, 1024, 140), 'image', 'image/jpeg', 'jpg'),
    clip: await upload(admin, s, readFileSync(mp4), 'video', 'video/mp4', 'mp4')
  };
}

const SEED: Record<Kind, (a: Assets) => { type: string; data: Record<string, unknown> }> = {
  motion: (a) => ({ type: 'motion', data: { format: '16:9', docHeadRevision: 1, posterAssetId: a.poster, lastRenderAssetId: null } }),
  'image-upload': (a) => ({ type: 'image', data: { prompt: '', assetId: a.picture } }),
  'video-upload': (a) => ({ type: 'video', data: { prompt: '', assetId: a.clip } }),
  text: () => ({ type: 'text', data: { prompt: 'Write three hooks for a running shoe launch', model: null } }),
  image: (a) => ({ type: 'image', data: { prompt: 'A red shoe on wet asphalt, studio light', refId: a.picture } }),
  video: () => ({ type: 'video', data: { prompt: 'Slow dolly in on the shoe', model: null } }),
  doc: () => ({ type: 'doc', data: { content: '# Launch brief\n\nAudience: urban runners 25–40.\nTone: confident, warm.\n\n- Hero film\n- Three cutdowns\n- Product stills', public: false } }),
  social_account_feed: () => ({ type: 'social_account_feed', data: { platform: 'instagram', handle: 'nike' } }),
  products: () => ({ type: 'products', data: { type: 'shopify', url: 'https://allbirds.com' } }),
  iframe: () => ({ type: 'iframe', data: { url: 'https://example.com' } }),
  calendar: () => ({ type: 'calendar', data: { view: 'month', scope: 'canvas', anchor: '2026-10-01' } }),
  list: () => ({ type: 'list', data: { itemKind: 'text', items: [{ text: 'one' }, { text: 'two' }] } }),
  audio: () => ({ type: 'audio', data: { prompt: 'Upbeat 120bpm bed' } })
};

async function seed(admin: SupabaseClient, s: E2eSession, count: number) {
  const a = await assets(admin, s);
  const rows = Array.from({ length: count }, (_, i) => {
    const kind = KINDS[i % KINDS.length];
    const { type, data } = SEED[kind](a);
    return { id: randomUUID(), org_id: s.orgId, project_id: s.projectId, canvas_id: s.canvasId, type, x: (i % COLUMNS) * STEP.x, y: Math.floor(i / COLUMNS) * STEP.y, data, actor_kind: 'user', actor_id: s.userId };
  });
  for (let i = 0; i < rows.length; i += 100) {
    expect((await admin.from('nodes').insert(rows.slice(i, i + 100))).error).toBeNull();
  }
  const frames = rows.filter((r) => r.type === 'motion');
  for (const f of frames) {
    expect((await admin.from('motion_revisions').insert({ org_id: s.orgId, node_id: f.id, version: 1, doc: plainDoc, actor_kind: 'user', actor_id: s.userId })).error).toBeNull();
  }
  const texts = rows.filter((r) => r.type === 'text');
  const images = rows.filter((r) => r.type === 'image' && r.data.prompt);
  const wires = texts.flatMap((t, i) => (images[i] ? [{ org_id: s.orgId, canvas_id: s.canvasId, source_node_id: t.id, target_node_id: images[i].id, target_handle: 'text', actor_kind: 'user', actor_id: s.userId }] : []));
  if (wires.length) {
    expect((await admin.from('nodes_connections').insert(wires)).error).toBeNull();
  }
}

async function open(page: Page, s: E2eSession, renderer: string) {
  const query = renderer === 'dom' ? '' : `?renderer=${renderer}`;
  await page.goto(`/p/${s.projectId}/c/${s.canvasId}${query}`);
  const ready = renderer === 'dom' ? page.locator('.svelte-flow__node').first() : page.locator('[data-testid="gpu-canvas"]');
  await expect(ready).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(SETTLE_MS);
}

async function nodeCentre(page: Page, renderer: string): Promise<{ x: number; y: number }> {
  const size = page.viewportSize()!;
  if (renderer === 'dom') {
    const boxes = await page.locator('.svelte-flow__node').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect));
    const box = boxes.find((b) => b.x > 0 && b.y > 60 && b.right < size.width && b.bottom < size.height - 80) ?? boxes[0];
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }
  return { x: size.width / 2, y: size.height / 2 };
}

async function heap(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const { metrics } = await cdp.send('Performance.getMetrics');
  const of = (name: string) => metrics.find((m) => m.name === name)?.value ?? 0;
  return { heapMb: Math.round(of('JSHeapUsedSize') / 1e6), domNodes: of('Nodes') };
}

async function runOne(browser: Browser, s: E2eSession, renderer: string, nodes: number, cookies: Parameters<BrowserContext['addCookies']>[0]): Promise<{ run: Run; video: string | null }> {
  const videoDir = join(OUT, 'raw');
  mkdirSync(videoDir, { recursive: true });
  const context = await browser.newContext({ viewport: DESKTOP, storageState: consent, recordVideo: { dir: videoDir, size: DESKTOP } });
  await context.addCookies(cookies);
  const page = await context.newPage();
  await page.addInitScript(instrument);
  await skipTour(page);
  await open(page, s, renderer);
  await page.screenshot({ path: join(OUT, `shot-${renderer}-${nodes}.png`) });
  const backend = renderer === 'dom' ? 'dom' : ((await page.locator('[data-testid="gpu-canvas"]').getAttribute('data-backend')) ?? '?');
  const pan = await measure(page, SWEEP_MS, (until) => wheelPan(page, until));
  const zoom = await measure(page, SWEEP_MS, (until) => wheelZoom(page, until));
  await open(page, s, renderer);
  const drag = await measure(page, 0, async () => dragFrom(page, await nodeCentre(page, renderer)));
  const memory = await heap(page);
  const video = page.video();
  await context.close();
  return { run: { renderer, nodes, backend, pan, zoom, drag, ...memory }, video: video ? await video.path() : null };
}

test.describe('GPU canvas against the DOM canvas on a real canvas @perf @real', () => {
  test.skip(!REAL_STACK || !process.env.E2E_GPU_COMPARE, 'E2E_REAL_STACK=1 E2E_GPU_COMPARE=1, headed Chrome');
  test.setTimeout(900_000);

  for (const count of COUNTS) {
    test(`${count} nodes`, async ({ browser, page, session, admin }) => {
      await seed(admin, session, count);
      const cookies = await page.context().cookies();
      const runs: Run[] = [];
      const videos: string[] = [];
      for (const renderer of RENDERERS) {
        const { run, video } = await runOne(browser, session, renderer, count, cookies);
        runs.push(run);
        if (video) {
          videos.push(video);
        }
        console.log(`[gpu-compare] ${JSON.stringify(run)}`);
      }
      mkdirSync(OUT, { recursive: true });
      writeFileSync(join(OUT, `compare-${count}.json`), JSON.stringify(runs, null, 2));
      if (videos.length > 1) {
        const inputs = videos.flatMap((v) => ['-i', v]);
        const labels = videos.map((_, i) => `[${i}:v]scale=960:-2,drawtext=text='${RENDERERS[i]}':x=20:y=20:fontsize=36:fontcolor=white:box=1:boxcolor=black@0.6[v${i}]`).join(';');
        const stack = `${videos.map((_, i) => `[v${i}]`).join('')}hstack=inputs=${videos.length}[out]`;
        execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...inputs, '-filter_complex', `${labels};${stack}`, '-map', '[out]', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', join(OUT, `side-by-side-${count}.mp4`)]);
      }
    });
  }
});
