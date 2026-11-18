import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { compareRepo, FEATURE_BRANCH } from './fixtures/compare-repo';

const BASE = process.env.E2E_BASE_URL;
const SHOTS = join(homedir(), 'Documents/feega-videos/shots/compare-versions');
const AUTH = { authorization: 'Bearer local', 'content-type': 'application/json' };
const IMPORT_MS = 300_000;
const HERO_TOP = 0.12;
const HERO_BOTTOM = 0.8;
const POSTER_MS = 120_000;

const inHero = (regions: Region[]) => regions.length > 0 && regions.every((r) => r.y >= HERO_TOP && r.y + r.h <= HERO_BOTTOM);

test.skip(!BASE, 'needs a local-mode Feega: E2E_BASE_URL pointing at FEEGA_LOCAL_FILE dev server');
test.setTimeout(10 * 60_000);
test.use({ actionTimeout: 30_000, viewport: { width: 1440, height: 900 } });

type Region = { y: number; h: number };

const git = (dir: string, ...args: string[]) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim();

async function api(request: APIRequestContext, path: string, body: unknown) {
  const res = await request.post(`${BASE}${path}`, { headers: AUTH, data: body, timeout: IMPORT_MS });
  expect(res.ok(), await res.text()).toBe(true);
  return res.json();
}

async function placeOf(page: Page) {
  await page.goto(BASE!);
  await page.waitForURL(/\/p\/[^/]+\/c\/[^/]+/);
  const [, projectId, canvasId] = page.url().match(/\/p\/([^/]+)\/c\/([^/?#]+)/)!;
  return { projectId, canvasId };
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
}

async function openVersion(page: Page, label: string) {
  const badges = page.locator('[data-testid="frame-header-icon"][data-badge="version"]');
  for (let i = 0; i < (await badges.count()); i++) {
    await badges.nth(i).dispatchEvent('click');
    if ((await page.getByTestId('version-compare').locator('header').textContent())?.includes(label)) {
      return;
    }
  }
  throw new Error(`no version frame named ${label}`);
}

async function regionsOn(page: Page): Promise<Region[]> {
  await expect(page.getByTestId('diff-count')).toHaveText(/changed/, { timeout: 120_000 });
  return page.getByTestId('version-diff-region').evaluateAll((els) =>
    els.map((el) => {
      const box = el.getBoundingClientRect();
      const stage = el.parentElement!.getBoundingClientRect();
      return { y: (box.top - stage.top) / stage.height, h: box.height / stage.height };
    })
  );
}

test('compare main with a branch, see only the changed regions, restore the branch as a modification', async ({ page, request }) => {
  mkdirSync(SHOTS, { recursive: true });
  const repo = compareRepo();
  const { projectId, canvasId } = await placeOf(page);

  const imported = await api(request, `/api/v1/projects/${projectId}/code-import`, { canvasId, folder: repo.dir, route: '/', designSystem: false, x: 0, y: 0 });
  const original = imported.nodes[0].id as string;
  await page.reload();
  await expect(page.locator(`[data-testid="frame-header-icon"][data-node="${original}"]`)).toBeVisible({ timeout: 90_000 });
  await shot(page, '01-linked-frame');

  await page.locator(`[data-testid="frame-header-icon"][data-node="${original}"]`).click();
  await shot(page, '02-github-popover');
  await page.getByTestId('compare-versions').dispatchEvent('click');
  await expect(page.getByTestId('ref-choice').first()).toBeVisible();
  await shot(page, '03-ref-picker');

  await page.locator(`[data-testid="ref-choice"][data-ref="main"]`).dispatchEvent('click');
  await page.locator(`[data-testid="ref-choice"][data-ref="${FEATURE_BRANCH}"]`).dispatchEvent('click');
  await page.getByTestId('ref-compare').dispatchEvent('click');
  await expect(page.getByTestId('ref-picker')).toBeHidden({ timeout: IMPORT_MS });
  await expect(page.getByTestId('version-compare')).toBeVisible({ timeout: 120_000 });

  await expect.poll(() => regionsOn(page), { timeout: POSTER_MS, intervals: [2_000] }).toEqual([]);
  await shot(page, '04-main-unchanged');

  const versions = (await api(request, `/api/v1/projects/${projectId}/github/versions`, { nodeId: original })) as { refs: { name: string }[] };
  expect(versions.refs.map((r) => r.name).sort()).toEqual([FEATURE_BRANCH, 'main']);

  await openVersion(page, FEATURE_BRANCH);
  await expect.poll(async () => inHero(await regionsOn(page)), { timeout: POSTER_MS, intervals: [2_000] }).toBe(true);
  const changed = await regionsOn(page);
  for (const r of changed) {
    expect(r.y).toBeGreaterThanOrEqual(HERO_TOP);
    expect(r.y + r.h).toBeLessThanOrEqual(HERO_BOTTOM);
  }
  await shot(page, '05-overlay-regions');

  await page.getByTestId('diff-mode-slider').dispatchEvent('click');
  await shot(page, '06-slider');

  await page.getByTestId('version-action-code_diff').dispatchEvent('click');
  await expect(page.getByTestId('version-code-diff')).toContainText('Book a demo');
  await shot(page, '07-code-diff');

  await page.getByTestId('version-action-restore').dispatchEvent('click');
  await expect(page.getByTestId('version-note')).toContainText('1 files restored');
  await shot(page, '08-restored');

  const pushed = await api(request, `/api/v1/projects/${projectId}/github/push`, { name: 'restore-cta', nodeIds: [original] });
  expect(pushed.branch).toBe('feega/restore-cta');
  expect(git(repo.dir, 'show', `${pushed.branch}:app/page.tsx`)).toBe(git(repo.dir, 'show', `${FEATURE_BRANCH}:app/page.tsx`));
  expect(git(repo.dir, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
});
