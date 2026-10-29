import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { pageTreeOf, TREE_LIMITS } from '../../src/lib/server/url-import/page-tree';
import { componentMarksOf, MARK_LIMITS } from '../../src/lib/server/code-import/component-marks';
import { sandboxRunner } from '../../src/lib/server/code-import/sandbox-runner';
import { repoOf } from '../../src/lib/server/code-import/repo';

const VIEWPORT = { width: 1280, height: 800 };
const SETTLE_MS = 3_000;
const NAV_TIMEOUT_MS = 60_000;

const [repoUrl, route, out, shot] = process.argv.slice(2);
const repo = repoOf(repoUrl ?? '');
if (!repo || !route || !out) {
  console.error('usage: tsx scripts/code-import/capture-repo.ts <github url> <route> <out.json> [shot.png]');
  process.exit(1);
}

const fromFile = (key: string) => (process.env.ENV_FILE ? readFileSync(process.env.ENV_FILE, 'utf8').match(new RegExp(`^${key}=["']?([^"'\n]+)`, 'm'))?.[1] : undefined);
const access = { token: process.env.VERCEL_TOKEN ?? fromFile('VERCEL_TOKEN'), teamId: process.env.VERCEL_TEAM_ID, projectId: process.env.VERCEL_PROJECT_ID };
const started = Date.now();
const run = await sandboxRunner(access)(repo);
if (!run.ok) {
  console.error(run.failure, run.detail);
  process.exit(1);
}
console.log('running', run.app.url, 'names', run.app.names.length, 'in', Date.now() - started, 'ms');

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(new URL(route, run.app.url).toString(), { waitUntil: 'networkidle', timeout: NAV_TIMEOUT_MS }).catch(() => undefined);
  await page.waitForTimeout(SETTLE_MS);
  const uses = await page.evaluate(`var __name = (f) => f; (${componentMarksOf.toString()})(${JSON.stringify({ names: run.app.names, limits: MARK_LIMITS, attr: TREE_LIMITS.useAttr })})`);
  const tree = await page.evaluate(`var __name = (f) => f; (${pageTreeOf.toString()})(${JSON.stringify(TREE_LIMITS)})`);
  writeFileSync(out, JSON.stringify({ tree, uses, names: run.app.names }));
  if (shot) {
    await page.screenshot({ path: shot });
  }
  console.log(out, (uses as unknown[]).length, 'uses');
} finally {
  await browser.close();
  await run.app.stop();
  console.log('stopped after', Date.now() - started, 'ms');
}
