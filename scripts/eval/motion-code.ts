import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium, type Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { env } from '../_shims/env-private';
import { createE2eSession, signInE2e, teardownE2eSession, type E2eSession } from '../../tests/e2e/fixtures/session';

const BASE_URL = env.MOTION_EVAL_URL ?? 'http://localhost:5173';
const OUT = env.MOTION_EVAL_OUT ?? join(process.cwd(), 'motion-eval-out');
const FIXTURES = env.MOTION_EVAL_FIXTURES ?? '';
const TURNS_FILE = env.MOTION_EVAL_TURNS ?? '';
const SPEND_CAP_USD = Number(env.MOTION_EVAL_CAP_USD ?? 5);
const TURN_TIMEOUT_MS = 6 * 60_000;
const EXPORT_TIMEOUT_MS = 20 * 60_000;
const SETTLE_MS = 5000;
const BUCKET = 'canvas-assets';

type Fixture = { file: string; type: 'image' | 'audio'; mime: string; seconds?: number };

const admin = createClient(env.PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

async function seedAssets(session: E2eSession, files: Fixture[]): Promise<void> {
  for (const f of files) {
    const bytes = readFileSync(join(FIXTURES, f.file));
    const path = `${session.orgId}/${session.projectId}/${randomUUID()}-${f.file}`;
    const up = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: f.mime });
    if (up.error) {
      throw new Error(`upload ${f.file}: ${up.error.message}`);
    }
    const row = await admin.from('assets').insert({ org_id: session.orgId, project_id: session.projectId, type: f.type, source: 'upload', url: path, mime_type: f.mime, bytes: bytes.length, duration_s: f.seconds ?? null });
    if (row.error) {
      throw new Error(`asset ${f.file}: ${row.error.message}`);
    }
  }
}

async function remapped(session: E2eSession, text: string): Promise<string> {
  const map: Record<string, string> = JSON.parse(env.MOTION_EVAL_ASSET_MAP ?? '{}');
  const { data } = await admin.from('assets').select('id, url').eq('org_id', session.orgId);
  let out = text;
  for (const [oldId, file] of Object.entries(map)) {
    const row = (data ?? []).find((a) => String(a.url).endsWith(`-${file}`));
    if (row) {
      out = out.split(oldId).join(row.id);
    }
  }
  return out;
}

async function spent(session: E2eSession): Promise<{ usd: number; byModel: Record<string, number> }> {
  const { data } = await admin.from('ai_calls').select('model, cost_usd').eq('org_id', session.orgId);
  const byModel: Record<string, number> = {};
  for (const c of data ?? []) {
    byModel[c.model] = (byModel[c.model] ?? 0) + Number(c.cost_usd ?? 0);
  }
  return { usd: Object.values(byModel).reduce((a, b) => a + b, 0), byModel };
}

async function turn(page: Page, message: string, index: number): Promise<void> {
  const input = page.locator('#chat-composer-input');
  await input.fill(message);
  const answered = page.waitForResponse((r) => /\/motion\/[^/]+\/agent$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST', { timeout: TURN_TIMEOUT_MS });
  await input.press('Enter');
  const response = await answered;
  await response.finished();
  await page.waitForTimeout(SETTLE_MS);
  await page.getByTestId('save-state').filter({ hasText: 'Saved' }).waitFor({ timeout: 60_000 }).catch(() => {});
  await page.screenshot({ path: join(OUT, `turn-${index + 1}.png`) });
}

async function exportMp4(page: Page): Promise<void> {
  await page.getByTestId('export-open').click();
  await page.getByTestId('export-start').waitFor({ timeout: 300_000 });
  await page.getByTestId('export-start').click();
  const download = page.getByTestId('export-download');
  await download.waitFor({ timeout: EXPORT_TIMEOUT_MS });
  const [event] = await Promise.all([page.waitForEvent('download'), download.click()]);
  await event.saveAs(join(OUT, 'trailer.mp4'));
  await page.getByRole('button', { name: 'Close' }).first().click();
}

async function codeTab(page: Page): Promise<void> {
  const doc = JSON.parse(readFileSync(join(OUT, 'doc.json'), 'utf8')) as { tracks: { clips: { id: string; component: string }[] }[] };
  const custom = doc.tracks.flatMap((t) => t.clips).find((c) => c.component === 'Custom');
  const bar = page.locator(`.bar[data-clip-id="${custom?.id}"]`);
  await bar.click();
  await page.getByTestId('code-tab-open').click();
  await page.locator('.cm-editor').waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, 'editor-code-tab.png') });
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const turns: string[] = JSON.parse(readFileSync(TURNS_FILE, 'utf8'));
  const fixtures: Fixture[] = JSON.parse(env.MOTION_EVAL_ASSETS ?? '[]');
  const session = await createE2eSession();
  const browser = await chromium.launch({ channel: 'chrome', headless: env.MOTION_EVAL_HEADED !== '1' });
  const errors: string[] = [];
  try {
    await seedAssets(session, fixtures);
    const page = await browser.newPage({ baseURL: BASE_URL, viewport: { width: 1720, height: 1040 }, acceptDownloads: true });
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    await signInE2e(page, session).catch(async () => {
      if (!/\/(app|p\/)/.test(page.url())) {
        await signInE2e(page, session);
      }
    });

    await page.goto(`${BASE_URL}/app/motion`);
    await page.waitForLoadState('networkidle');
    await page.locator('[data-testid="motion-new"] input[name="name"]').fill('feega trailer (code)');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/\/motion\//);
    await page.getByTestId('motion-preview').waitFor();
    await page.waitForLoadState('networkidle');

    const seed = env.MOTION_EVAL_SEED_DOC ? (JSON.parse(await remapped(session, readFileSync(env.MOTION_EVAL_SEED_DOC, 'utf8'))) as { components: Record<string, { check: unknown }> }) : null;
    if (seed) {
      const nodeId = new URL(page.url()).pathname.split('/').at(-1) ?? '';
      const fresh = { ...seed, components: Object.fromEntries(Object.entries(seed.components).map(([k, c]) => [k, { ...c, check: null }])) };
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: nodeId, version: 1, doc: fresh, summary: 'replayed agent doc', actor_kind: 'user', actor_id: session.userId });
      if (error) {
        throw new Error(`seed doc: ${error.message}`);
      }
      await page.reload();
      await page.getByTestId('motion-preview').waitFor();
      await page.waitForLoadState('networkidle');
    }

    for (const [i, message] of turns.entries()) {
      const before = await spent(session);
      if (before.usd >= SPEND_CAP_USD) {
        console.log(`spend cap reached before turn ${i + 1}: $${before.usd.toFixed(3)}`);
        break;
      }
      const t0 = Date.now();
      await turn(page, message, i);
      const after = await spent(session);
      console.log(`turn ${i + 1}: ${Math.round((Date.now() - t0) / 1000)}s, $${(after.usd - before.usd).toFixed(3)} (total $${after.usd.toFixed(3)})`);
    }

    const { data: node } = await admin.from('nodes').select('id').eq('org_id', session.orgId).eq('type', 'motion').single();
    const { data: head } = await admin.from('motion_revisions').select('doc, version').eq('org_id', session.orgId).eq('node_id', node?.id ?? '').order('version', { ascending: false }).limit(1).maybeSingle();
    writeFileSync(join(OUT, 'doc.json'), JSON.stringify(head?.doc ?? null, null, 2));

    await page.screenshot({ path: join(OUT, 'editor.png') });
    await codeTab(page).catch((e) => console.log('code tab screenshot failed', e));
    await exportMp4(page);
    const total = await spent(session);
    console.log(`AI spend: $${total.usd.toFixed(4)}`, total.byModel);
    writeFileSync(join(OUT, 'spend.json'), JSON.stringify(total, null, 2));
  } catch (e) {
    for (const p of browser.contexts().flatMap((c) => c.pages())) {
      await p.screenshot({ path: join(OUT, 'failure.png') }).catch(() => {});
    }
    throw e;
  } finally {
    writeFileSync(join(OUT, 'console-errors.txt'), errors.join('\n'));
    await browser.close();
    await teardownE2eSession(session);
  }
}

await main();
