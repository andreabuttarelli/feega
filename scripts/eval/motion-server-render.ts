import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { env } from '../_shims/env-private';
import { createE2eSession, signInE2e, teardownE2eSession } from '../../tests/e2e/fixtures/session';

const BASE_URL = env.MOTION_EVAL_URL ?? 'http://localhost:5173';
const OUT = env.MOTION_EVAL_OUT ?? join(process.cwd(), 'motion-eval-out');
const FIXTURES = env.MOTION_EVAL_FIXTURES ?? '';
const DOC = env.MOTION_EVAL_DOC ?? '';
const RENDER_TIMEOUT_MS = 6 * 60_000;
const CHECK_TIMEOUT_MS = 4 * 60_000;
const BUCKET = 'canvas-assets';
const IMAGES = ['sneaker.png', 'tee.png', 'bell.png', 'suit.png'];
const MUSIC = { file: 'music.mp3', mime: 'audio/mpeg', seconds: 32 };

type DocAsset = { id: string; kind: string };

const admin = createClient(env.PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

async function seedAsset(session: { orgId: string; projectId: string }, file: string, type: string, mime: string, seconds: number | null): Promise<string> {
  const bytes = readFileSync(join(FIXTURES, file));
  const path = `${session.orgId}/${session.projectId}/${randomUUID()}-${file}`;
  const up = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: mime });
  if (up.error) {
    throw new Error(`upload ${file}: ${up.error.message}`);
  }
  const row = await admin.from('assets').insert({ org_id: session.orgId, project_id: session.projectId, type, source: 'upload', url: path, mime_type: mime, bytes: bytes.length, duration_s: seconds }).select('id').single();
  if (row.error) {
    throw new Error(`asset ${file}: ${row.error.message}`);
  }
  return row.data.id as string;
}

async function remapAssets(session: { orgId: string; projectId: string }, raw: string): Promise<string> {
  const assets = (JSON.parse(raw) as { assets: DocAsset[] }).assets;
  const images = [...IMAGES];
  let doc = raw;
  for (const a of assets) {
    const fresh = a.kind === 'audio' ? await seedAsset(session, MUSIC.file, 'audio', MUSIC.mime, MUSIC.seconds) : await seedAsset(session, images.shift()!, 'image', 'image/png', null);
    doc = doc.replaceAll(a.id, fresh);
  }
  return doc;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const session = await createE2eSession({ withCredits: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: env.MOTION_EVAL_HEADED !== '1' });
  const timeline: { s: number; text: string }[] = [];
  try {
    const doc = await remapAssets(session, readFileSync(DOC, 'utf8'));
    const nodeId = randomUUID();
    const node = await admin.from('nodes').insert({ id: nodeId, org_id: session.orgId, project_id: session.projectId, canvas_id: session.canvasId, type: 'motion', x: 0, y: 0, data: { format: '16:9', docHeadRevision: 0, posterAssetId: null, lastRenderAssetId: null }, actor_kind: 'user', actor_id: session.userId });
    if (node.error) {
      throw new Error(`node: ${node.error.message}`);
    }

    const page = await browser.newPage({ baseURL: BASE_URL, viewport: { width: 1600, height: 1000 } });
    await signInE2e(page, session).catch(() => signInE2e(page, session));
    const editor = `/p/${session.projectId}/c/${session.canvasId}/motion/${nodeId}`;
    await page.goto(editor);
    await page.getByTestId('motion-preview').waitFor();

    const saved = await page.evaluate(
      async ({ editor, doc }) => {
        const form = new FormData();
        form.set('version', '0');
        form.set('doc', doc);
        const res = await fetch(`${editor}?/save`, { method: 'POST', body: form, headers: { 'x-sveltekit-action': 'true' } });
        return res.text();
      },
      { editor, doc }
    );
    console.log('save:', saved.slice(0, 120));
    await page.reload();
    await page.getByTestId('motion-preview').waitFor();
    await page.getByTestId('save-state').filter({ hasText: 'Saved' }).waitFor();

    await page.getByTestId('export-open').click();
    console.log('quote:', await page.getByTestId('export-quote').textContent());
    const start = page.getByTestId('export-start-server');
    await start.waitFor({ timeout: CHECK_TIMEOUT_MS });
    await page.waitForFunction(() => {
      const button = document.querySelector('[data-testid="export-start-server"]') as HTMLButtonElement | null;
      return button !== null && !button.disabled;
    }, null, { timeout: CHECK_TIMEOUT_MS });
    const t0 = Date.now();
    await start.click();
    await page.getByTestId('export-progress').waitFor({ timeout: 30_000 });
    const progress = page.getByTestId('export-progress');
    const done = page.getByTestId('export-download');
    const failed = page.getByTestId('export-failed');
    while (Date.now() - t0 < RENDER_TIMEOUT_MS) {
      if (await done.isVisible()) {
        break;
      }
      if (await failed.isVisible()) {
        throw new Error(`render failed: ${await failed.textContent()}`);
      }
      const text = (await progress.textContent().catch(() => '')) ?? '';
      if (text && timeline.at(-1)?.text !== text.trim()) {
        timeline.push({ s: (Date.now() - t0) / 1000, text: text.trim() });
        console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s ${text.trim()}`);
      }
      await page.waitForTimeout(500);
    }
    const wall = (Date.now() - t0) / 1000;
    console.log(`wall: ${wall.toFixed(1)}s`);
    await page.screenshot({ path: join(OUT, 'export-done.png') });

    const runs = await admin.from('node_runs').select('status, cost_usd, params, output_asset_id, started_at, finished_at').eq('node_id', nodeId);
    const run = runs.data?.[0];
    const asset = await admin.from('assets').select('url, bytes, ai_marked').eq('id', run?.output_asset_id ?? '').single();
    const file = await admin.storage.from(BUCKET).download(asset.data!.url as string);
    writeFileSync(join(OUT, 'trailer-server.mp4'), Buffer.from(await file.data!.arrayBuffer()));
    const calls = await admin.from('ai_calls').select('operation, cost_usd, billed_credits').eq('org_id', session.orgId);
    const report = { wallSeconds: wall, run, asset: asset.data, aiCalls: calls.data, timeline };
    writeFileSync(join(OUT, 'timings.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ status: run?.status, cost_usd: run?.cost_usd, ai_calls: calls.data, ai_marked: asset.data?.ai_marked, bytes: asset.data?.bytes }));
  } finally {
    await browser.close();
    await teardownE2eSession(session);
  }
}

await main();
