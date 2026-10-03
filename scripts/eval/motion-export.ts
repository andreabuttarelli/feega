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

type Fixture = { file: string; type: 'image' | 'video' | 'audio' | 'model3d'; mime: string };
type Scenario = { name: string; template: string; edit?: (page: Page) => Promise<void>; chat?: string };

const FIXTURE_FILES: Fixture[] = [
  { file: 'sneaker.png', type: 'image', mime: 'image/png' },
  { file: 'model.glb', type: 'model3d', mime: 'model/gltf-binary' },
  { file: 'music.mp3', type: 'audio', mime: 'audio/mpeg' },
  { file: 'vo.mp3', type: 'audio', mime: 'audio/mpeg' }
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
    const row = await admin.from('assets').insert({ org_id: session.orgId, project_id: session.projectId, type: f.type, source: 'upload', url: path, mime_type: f.mime, bytes: bytes.length });
    if (row.error) {
      throw new Error(`asset ${f.file}: ${row.error.message}`);
    }
  }
}

async function removeExports(session: E2eSession): Promise<void> {
  const root = `${session.orgId}/${session.projectId}/motion`;
  const { data: nodes } = await admin.storage.from(BUCKET).list(root);
  for (const node of nodes ?? []) {
    const { data: files } = await admin.storage.from(BUCKET).list(`${root}/${node.name}`);
    await admin.storage.from(BUCKET).remove((files ?? []).map((f) => `${root}/${node.name}/${f.name}`));
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

async function run(scenario: Scenario, page: Page): Promise<void> {
  await newVideo(page, scenario.name);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('menuitem', { name: scenario.template }).click();
  await page.waitForTimeout(1500);
  await scenario.edit?.(page);
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
    await signInE2e(page, session);
    for (const scenario of scenarios) {
      await run(scenario, page);
    }
  } catch (e) {
    for (const p of browser.contexts().flatMap((c) => c.pages())) {
      await p.screenshot({ path: join(OUT, 'failure.png') }).catch(() => {});
    }
    throw e;
  } finally {
    writeFileSync(join(OUT, 'console-errors.txt'), errors.join('\n'));
    await browser.close();
    await removeExports(session);
    await teardownE2eSession(session);
  }
}

await main();
