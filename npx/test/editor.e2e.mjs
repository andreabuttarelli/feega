import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const APP = here('../../landing');
const CLI = here('../dist/cli.cjs');
const PORT = 4719;
const READY_MS = 120_000;
const SHOTS = process.env.FEEGA_E2E_SHOTS;
const COLOUR = '#0078d4';

function started() {
  const cli = spawn(process.execPath, [CLI, APP, '--port', String(PORT), '--no-open'], { stdio: ['ignore', 'pipe', 'inherit'] });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('the editor did not start')), READY_MS);
    cli.stdout.on('data', (data) => {
      process.stdout.write(data);
      const url = /editor ready on (\S+)/.exec(String(data))?.[1];
      if (url) {
        clearTimeout(timer);
        resolve({ cli, url });
      }
    });
    cli.once('exit', () => reject(new Error('the CLI exited')));
  });
}

const changedFiles = () => execFileSync('git', ['-C', APP, 'diff', '--name-only', '--relative'], { encoding: 'utf8' }).split('\n').filter(Boolean);
const diffOf = (file) => execFileSync('git', ['-C', APP, 'diff', '--relative', '--', file], { encoding: 'utf8' }).split('\n');

const shot = (page, name) => SHOTS && page.screenshot({ path: join(SHOTS, `${name}.png`) });

const { cli, url } = await started();
const browser = await chromium.launch();
let restore = null;
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(url);
  const frame = page.frameLocator('[data-testid="app-frame"]');
  await page.getByText('Click an element to edit it').waitFor({ timeout: READY_MS });
  await shot(page, '1-open');

  await frame.locator('h1').first().click();
  const field = page.locator('[data-row="color"] input[aria-label="Colour hex"]');
  await field.waitFor();
  await shot(page, '2-selected');
  assert.deepEqual(changedFiles(), [], 'the app starts clean');

  await field.fill(COLOUR);
  await field.press('Enter');
  await page.waitForTimeout(1500);
  await shot(page, '3-edited');
  const changed = changedFiles();
  assert.equal(changed.length, 1, `one file changes: ${changed.join(', ')}`);
  restore = () => execFileSync('git', ['-C', APP, 'checkout', '--', ...changed]);
  const added = diffOf(changed[0]).filter((line) => line.startsWith('+') && !line.startsWith('+++'));
  const written = added.find((line) => /0078d4/i.test(line));
  assert.ok(written, `the colour is written to ${changed[0]}:\n${added.join('\n')}`);

  await page.getByRole('button', { name: /^Undo/ }).first().click();
  await page.waitForTimeout(1500);
  assert.deepEqual(changedFiles(), [], 'undo restores the file');
  restore = null;
  console.log(`FEEGA_NPX_E2E_OK ${changed[0]} ${written.trim()}`);
} finally {
  restore?.();
  rmSync(join(APP, '.feega'), { recursive: true, force: true });
  await browser.close();
  cli.kill('SIGINT');
}
