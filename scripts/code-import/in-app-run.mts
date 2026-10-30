import { chromium, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.APP_BASE ?? 'http://localhost:5291';
const OUT = process.env.OUT_DIR!;
const PROJECT_PREFIX = process.env.PROJECT_PREFIX!;
const IMPORT_MS = 420_000;

mkdirSync(OUT, { recursive: true });

async function action(page: Page, path: string, name: string, form: Record<string, string> = {}) {
  return page.evaluate(async ([path, name, form]) => {
    const body = new FormData();
    Object.entries(form).forEach(([k, v]) => body.set(k, v));
    const res = await fetch(`${path}?/${name}`, { method: 'POST', headers: { 'x-sveltekit-action': 'true' }, body });
    return { status: res.status, text: (await res.text()).slice(0, 300) };
  }, [path, name, form] as const);
}

async function importing(page: Page, fill: () => Promise<void>, label: string) {
  await page.getByTestId('insert-open').click();
  await page.getByTestId('insert-menu').getByText('From code…').click();
  await page.getByTestId('code-import-dialog').waitFor();
  await fill();
  await page.screenshot({ path: join(OUT, `${label}-dialog.png`) });
  const answer = page.waitForResponse((r) => r.url().includes('/code-import') && r.request().method() === 'POST', { timeout: IMPORT_MS });
  const started = Date.now();
  await page.getByTestId('code-import-run').click();
  const res = await answer;
  const body = await res.json().catch(() => null);
  writeFileSync(join(OUT, `${label}-answer.json`), JSON.stringify({ status: res.status(), ms: Date.now() - started, body: body && { ...body, nodes: undefined, undo: undefined } }, null, 2));
  await page.waitForTimeout(6_000);
  await page.screenshot({ path: join(OUT, `${label}-canvas.png`) });
  return body;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
let projectId = '';
let canvasId = '';
try {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type=email]', process.env.E2E_TEST_EMAIL!);
  await page.fill('input[type=password]', process.env.E2E_TEST_PASSWORD!);
  await page.press('input[type=password]', 'Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { waitUntil: 'commit', timeout: 60_000 });

  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(5_000);
  const html = await page.content();
  projectId = page.url().match(new RegExp(`/p/(${PROJECT_PREFIX}[0-9a-f-]{20,})`))?.[1] ?? html.match(new RegExp(`(${PROJECT_PREFIX}[0-9a-f]{0,8}-[0-9a-f-]{20,})`))?.[1] ?? '';
  console.log('landed', page.url());
  await page.goto(`${BASE}/p/${projectId}`);
  await page.waitForURL((u) => u.pathname.includes('/c/'), { timeout: 60_000 });
  const home = new URL(page.url()).pathname;
  canvasId = crypto.randomUUID();
  console.log('project', projectId, 'canvas', canvasId, JSON.stringify(await action(page, home, 'new_canvas', { id: canvasId })));

  await page.goto(`${BASE}/p/${projectId}/c/${canvasId}`);
  await page.getByTestId('insert-open').waitFor({ timeout: 60_000 });
  await page.waitForTimeout(3_000);

  await importing(
    page,
    async () => {
      await page.getByTestId('code-import-repo').fill('https://github.com/satnaing/shadcn-admin');
      await page.getByTestId('code-import-route').fill('/ /settings');
    },
    'repo'
  );
  await importing(
    page,
    async () => {
      await page.getByTestId('code-import-tab-storybook').click();
      await page.getByTestId('code-import-storybook').fill('https://storybook.heroui.com/');
    },
    'storybook'
  );
} finally {
  if (projectId && canvasId) {
    console.log('delete', JSON.stringify(await action(page, `/p/${projectId}/c/${canvasId}`, 'delete_canvas')));
  }
  await browser.close();
}
