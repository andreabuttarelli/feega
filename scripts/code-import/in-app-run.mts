import { chromium, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.APP_BASE ?? 'http://localhost:5291';
const OUT = process.env.OUT_DIR!;
const PROJECT_ID = process.env.PROJECT_ID!;
const IMPORT_MS = 420_000;
const IMPORTS = (process.env.IMPORTS ?? 'repo,storybook').split(',');

mkdirSync(OUT, { recursive: true });

async function action(page: Page, path: string, name: string, form: Record<string, string> = {}) {
  return page.evaluate(
    async ([path, name, form]) => {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => body.set(k, v));
      const res = await fetch(`${path}?/${name}`, { method: 'POST', headers: { 'x-sveltekit-action': 'true' }, body });
      return { status: res.status, text: (await res.text()).slice(0, 300) };
    },
    [path, name, form] as const
  );
}

async function importing(page: Page, fill: () => Promise<void>, label: string) {
  await page.getByTestId('insert-open').click();
  await page.getByTestId('insert-menu').getByText('From code…').click();
  await page.getByTestId('code-import-dialog').waitFor();
  await fill();
  await page.screenshot({ path: join(OUT, `${label}-dialog.png`) }).catch(() => undefined);
  const answer = page.waitForResponse((r) => r.url().includes('/code-import') && r.request().method() === 'POST', { timeout: IMPORT_MS });
  const started = Date.now();
  await page.getByTestId('code-import-run').click();
  const res = await answer;
  const body = await res.json().catch(() => null);
  writeFileSync(join(OUT, `${label}-answer.json`), JSON.stringify({ status: res.status(), ms: Date.now() - started, body: body && { ...body, nodes: undefined, undo: undefined } }, null, 2));
  await page.waitForTimeout(6_000);
  await page.screenshot({ path: join(OUT, `${label}-canvas.png`) }).catch(() => undefined);
}

const SOURCES: Record<string, (page: Page) => Promise<void>> = {
  repo: async (page) => {
    await page.getByTestId('code-import-repo').fill('https://github.com/satnaing/shadcn-admin');
    await page.getByTestId('code-import-route').fill('/ /settings');
  },
  storybook: async (page) => {
    await page.getByTestId('code-import-tab-storybook').click();
    await page.getByTestId('code-import-storybook').fill('https://storybook.heroui.com/');
  }
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const canvasId = crypto.randomUUID();
let created = false;
try {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type=email]', process.env.E2E_TEST_EMAIL!);
  await page.fill('input[type=password]', process.env.E2E_TEST_PASSWORD!);
  await page.press('input[type=password]', 'Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { waitUntil: 'commit', timeout: 60_000 });

  await page.goto(`${BASE}/p/${PROJECT_ID}`);
  await page.waitForURL((u) => u.pathname.includes('/c/'), { timeout: 60_000 });
  writeFileSync(join(OUT, 'canvas.txt'), `${PROJECT_ID} ${canvasId}`);
  const made = await action(page, new URL(page.url()).pathname, 'new_canvas', { id: canvasId });
  created = true;
  console.log('canvas', canvasId, made.status);

  await page.goto(`${BASE}/p/${PROJECT_ID}/c/${canvasId}`);
  await page.getByTestId('insert-open').waitFor({ timeout: 60_000 });
  await page.waitForTimeout(3_000);
  for (const label of IMPORTS) {
    await importing(page, () => SOURCES[label](page), label);
  }
} finally {
  if (created) {
    console.log('delete', JSON.stringify(await action(page, `/p/${PROJECT_ID}/c/${canvasId}`, 'delete_canvas')));
  }
  await browser.close();
}
