import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import easing from './fixtures/gpu-docs/easing.json' with { type: 'json' };
import post from './fixtures/gpu-docs/post.json' with { type: 'json' };
import supasito from './fixtures/gpu-docs/supasito.json' with { type: 'json' };
import generative from './fixtures/gpu-docs/generative.json' with { type: 'json' };
import asteroids from './fixtures/gpu-docs/asteroids.json' with { type: 'json' };

type Doc = { width: number; height: number; fps: number; durationInFrames: number };

const DOCS: [string, Doc, Engine][] = [
  ['easing', easing as Doc, 'gpu'],
  ['post', post as Doc, 'gpu'],
  ['supasito', supasito as Doc, 'gpu'],
  ['generative', generative as Doc, 'html'],
  ['asteroids', asteroids as Doc, 'html']
];

type Engine = 'gpu' | 'html';

const MOTION_DATA = (doc: Doc) => ({ format: doc.width > doc.height ? '16:9' : '4:5', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null });
const EXPORT_TIMEOUT_MS = 600_000;
const PLAY_MS = 2000;
const OPEN_TIMEOUT_MS = 60_000;
const MIN_SSIM = 0.99;
const DURATION_SLACK_S = 0.1;
const SABOTAGE_AFTER_FRAMES = 5;

async function seededEditor(page: Page, doc: Doc, { session, admin, seedNode }: { session: { orgId: string; userId: string; projectId: string; canvasId: string }; admin: import('@supabase/supabase-js').SupabaseClient; seedNode: (s: { type: string; data: Record<string, unknown> }) => Promise<{ id: string }> }) {
  const node = await seedNode({ type: 'motion', data: MOTION_DATA(doc) });
  const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
  expect(error).toBeNull();
  return `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`;
}

async function exported(page: Page, dir: string, name: string): Promise<{ file: string; engine: string | null }> {
  await page.route('**/*?/exported', (route) => route.abort());
  await page.getByTestId('export-open').click();
  const choose = page.getByTestId('export-mode-video');
  if (await choose.isVisible().catch(() => false)) {
    await choose.click();
  }
  await page.getByTestId('export-start').click();
  const link = page.getByTestId('export-download');
  await expect(link).toBeVisible({ timeout: EXPORT_TIMEOUT_MS });
  const href = await link.getAttribute('href');
  const bytes = await page.evaluate(async (url) => {
    const buffer = new Uint8Array(await (await fetch(url as string)).arrayBuffer());
    let out = '';
    for (let i = 0; i < buffer.length; i += 0x8000) {
      out += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
    }
    return btoa(out);
  }, href);
  const file = join(dir, `${name}.mp4`);
  writeFileSync(file, Buffer.from(bytes, 'base64'));
  return { file, engine: await page.getByTestId('motion-preview').getAttribute('data-export-engine') };
}

function probe(file: string) {
  const out = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate:format=duration', '-of', 'json', file]).toString());
  const [num, den] = String(out.streams[0].r_frame_rate).split('/').map(Number);
  return { width: out.streams[0].width, height: out.streams[0].height, fps: num / den, duration: Number(out.format.duration) };
}

function ssimOf(a: string, b: string): number {
  const result = execFileSync('sh', ['-c', `ffmpeg -hide_banner -i "${a}" -i "${b}" -lavfi ssim -f null - 2>&1 | grep -o 'All:[0-9.]*' | tail -1`]).toString();
  return Number(result.replace('All:', ''));
}

async function playPreview(page: Page, engine: Engine) {
  await page.getByRole('button', { name: 'Play', exact: true }).click({ timeout: OPEN_TIMEOUT_MS });
  await page.waitForTimeout(PLAY_MS);
  await page.keyboard.press('Space');
  await expect(page.getByTestId('gpu-motion-canvas')).toHaveCount(engine === 'gpu' ? 1 : 0);
}

test.describe('GPU motion engine is the default @real', () => {
  test.skip(!REAL_STACK, 'richiede lo stack reale: E2E_REAL_STACK=1');
  test.setTimeout(EXPORT_TIMEOUT_MS * 3);

  for (const [name, doc, engine] of DOCS) {
    test(`${name}: previews and exports on the ${engine} engine, same video as the HTML engine`, async ({ page, session, admin, seedNode }) => {
      const dir = mkdtempSync(join(tmpdir(), `gpu-${name}-`));
      try {
        page.on('pageerror', (e) => console.log('pageerror', e.message));
        page.on('response', (r) => r.status() >= 500 && console.log('5xx', r.status(), r.url()));
        const url = await seededEditor(page, doc, { session, admin, seedNode });
        await gotoHydrated(page, url);
        await playPreview(page, engine);
        const gpu = await exported(page, dir, 'default');
        expect(gpu.engine).toBe(engine);

        await gotoHydrated(page, `${url}?engine=html`);
        const html = await exported(page, dir, 'html');
        expect(html.engine).toBe('html');

        const made = probe(gpu.file);
        expect([made.width, made.height]).toEqual([doc.width, doc.height]);
        expect(made.fps).toBeCloseTo(doc.fps, 1);
        expect(Math.abs(made.duration - doc.durationInFrames / doc.fps)).toBeLessThan(DURATION_SLACK_S);
        expect(ssimOf(gpu.file, html.file)).toBeGreaterThanOrEqual(MIN_SSIM);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }

  test('a GPU failure mid-export redoes the export on the HTML engine', async ({ page, session, admin, seedNode }) => {
    const dir = mkdtempSync(join(tmpdir(), 'gpu-fail-'));
    try {
      await page.addInitScript((after) => {
        const original = window.createImageBitmap.bind(window);
        let seen = 0;
        window.createImageBitmap = ((source: unknown, ...rest: unknown[]) => {
          if ((source as HTMLCanvasElement)?.dataset?.engine === 'gpu' && ++seen > after) {
            return Promise.reject(new Error('GPU device lost (test)'));
          }
          return (original as (...a: unknown[]) => Promise<ImageBitmap>)(source, ...rest);
        }) as typeof createImageBitmap;
      }, SABOTAGE_AFTER_FRAMES);
      const url = await seededEditor(page, easing as Doc, { session, admin, seedNode });
      await gotoHydrated(page, url);
      const out = await exported(page, dir, 'fallback');
      expect(out.engine).toBe('html');
      const made = probe(out.file);
      expect(Math.abs(made.duration - (easing as Doc).durationInFrames / (easing as Doc).fps)).toBeLessThan(DURATION_SLACK_S);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
