import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const APP = resolve(process.env.FEEGA_E2E_APP);
const CLI = here('../dist/cli.cjs');
const SHOTS = join(homedir(), 'Documents/feega-videos/screens');
const PORT = 4723;
const READY_MS = 120_000;
const SLIDE_COUNT = 4;

const home = mkdtempSync(join(tmpdir(), 'feega-onb-home-'));
const env = { ...process.env, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: join(home, '.config'), XDG_CACHE_HOME: join(home, '.cache'), FEEGA_STOP_ON_STDIN_END: '1' };

const cli = spawn(process.execPath, [CLI, APP, '--port', String(PORT), '--no-open'], { stdio: ['pipe', 'pipe', 'inherit'], env });
const url = await new Promise((done, fail) => {
  const timer = setTimeout(() => fail(new Error('the editor did not start')), READY_MS);
  cli.stdout.on('data', (data) => {
    const found = /editor ready on (\S+)/.exec(String(data))?.[1];
    if (found) {
      clearTimeout(timer);
      done(found);
    }
  });
});

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
await page.goto(url);
await page.locator('[data-testid=onboarding]').waitFor({ timeout: 60_000 });

for (let slide = 1; slide <= SLIDE_COUNT; slide++) {
  await page.waitForTimeout(200);
  await page.locator('[role=alertdialog]').screenshot({ path: join(SHOTS, `onboarding-${slide}.png`) });
  if (slide < SLIDE_COUNT) {
    await page.locator('[data-testid=onboarding-next]').click();
  }
}

await page.keyboard.press('Escape');
assert.equal(await page.locator('[role=alertdialog]').count(), 0);
await page.waitForTimeout(500);
assert.ok(existsSync(join(home, '.config', 'feega', 'onboarding.json')), 'seen flag lands in the config dir');

await page.reload();
await page.locator('[data-testid=app-frame]').waitFor({ timeout: 60_000 });
await page.waitForTimeout(1500);
assert.equal(await page.locator('[role=alertdialog]').count(), 0, 'not shown the second time');

await browser.close();
cli.stdin.end();
console.log('onboarding ok', home);
