import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium, type Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { env } from '../_shims/env-private';
import { createE2eSession, signInE2e, teardownE2eSession, type E2eSession } from '../../tests/e2e/fixtures/session';

const BASE_URL = env.MOTION_EVAL_URL ?? 'http://localhost:5173';
const OUT = env.MOTION_EVAL_OUT ?? join(process.cwd(), 'motion-eval-out');
const FIXTURES = env.MOTION_EVAL_FIXTURES ?? '';
const EXPORT_TIMEOUT_MS = 15 * 60_000;
const BUCKET = 'canvas-assets';

type Fixture = { file: string; type: 'image' | 'video' | 'audio' | 'model3d'; mime: string; seconds?: number };
type Scenario = { name: string; template: string; edit?: Edit; chat?: Chat };
type Edit = { clip: string; text: string; color: string };
type Chat = { message: string; clip: string; expect: string };

const FIXTURE_FILES: Fixture[] = [
  { file: 'sneaker.png', type: 'image', mime: 'image/png' },
  { file: 'tee.png', type: 'image', mime: 'image/png' },
  { file: 'ugc.mp4', type: 'video', mime: 'video/mp4', seconds: 12 },
  { file: 'model.glb', type: 'model3d', mime: 'model/gltf-binary' },
  { file: 'music.mp3', type: 'audio', mime: 'audio/mpeg', seconds: 32 },
  { file: 'vo.mp3', type: 'audio', mime: 'audio/mpeg', seconds: 4 }
];

const admin = createClient(env.PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

async function seedAssets(session: E2eSession): Promise<void> {
  for (const f of FIXTURE_FILES) {
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

async function newVideo(page: Page, name: string): Promise<void> {
  await page.goto(`${BASE_URL}/app/motion`);
  await page.waitForLoadState('networkidle');
  await page.locator('[data-testid="motion-new"] input[name="name"]').fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForURL(/\/motion\//);
  await page.getByTestId('motion-preview').waitFor();
  await page.waitForLoadState('networkidle');
}

async function exportMp4(page: Page, scenario: Scenario): Promise<string> {
  await page.getByTestId('export-open').click();
  await page.getByTestId('export-mode-video').click();
  await page.getByTestId('export-start').click();
  const download = page.getByTestId('export-download');
  await download.waitFor({ timeout: EXPORT_TIMEOUT_MS });
  const saved = await page.getByTestId('export-saved').textContent();
  console.log(`[${scenario.name}] ${saved}`);
  const file = join(OUT, `${scenario.name}.mp4`);
  const [event] = await Promise.all([page.waitForEvent('download'), download.click()]);
  await event.saveAs(file);
  await page.getByRole('button', { name: 'Close' }).first().click();
  return file;
}

const CHAT_TIMEOUT_MS = 180_000;

async function inspect(page: Page, edit: Edit): Promise<void> {
  await page.locator(`.bar[data-clip-id="${edit.clip}"]`).click();
  const text = page.locator('#f-text');
  await text.fill(edit.text);
  await text.blur();
  await page.locator('aside.props').getByRole('button', { name: edit.color }).first().click();
  await page.waitForTimeout(800);
}

async function chat(page: Page, ask: Chat): Promise<void> {
  const input = page.locator('#chat-composer-input');
  await input.fill(ask.message);
  await input.press('Enter');
  await page.locator(`.bar[data-clip-id="${ask.clip}"] .label`, { hasText: ask.expect }).waitFor({ timeout: CHAT_TIMEOUT_MS });
}

async function run(scenario: Scenario, page: Page): Promise<void> {
  await newVideo(page, scenario.name);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('menuitem', { name: scenario.template }).click();
  await page.waitForTimeout(1500);
  if (scenario.edit) {
    await inspect(page, scenario.edit);
  }
  if (scenario.chat) {
    await chat(page, scenario.chat);
  }
  await page.getByRole('status', { name: /^Saved/ }).waitFor();
  await page.screenshot({ path: join(OUT, `${scenario.name}-editor.png`) });
  const file = await exportMp4(page, scenario);
  console.log(`[${scenario.name}] exported ${basename(file)}`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const scenarios: Scenario[] = JSON.parse(env.MOTION_EVAL_SCENARIOS ?? '[{"name":"trailer","template":"feega trailer template"}]');
  const session = await createE2eSession();
  const browser = await chromium.launch({ channel: 'chrome', headless: env.MOTION_EVAL_HEADED !== '1' });
  const errors: string[] = [];
  try {
    await seedAssets(session);
    const page = await browser.newPage({ baseURL: BASE_URL, viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    await signInE2e(page, session).catch(() => signInE2e(page, session));
    for (const scenario of scenarios) {
      await run(scenario, page);
    }
    const calls = await admin.from('ai_calls').select('model, cost_usd').eq('org_id', session.orgId);
    const spent = (calls.data ?? []).reduce((sum, c) => sum + Number(c.cost_usd ?? 0), 0);
    console.log(`AI spend: $${spent.toFixed(4)} over ${calls.data?.length ?? 0} calls`);
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
