import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { connect } from 'node:net';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const APP = process.env.FEEGA_E2E_APP ? resolve(process.env.FEEGA_E2E_APP) : here('../../landing');
const CLI = here('../dist/cli.cjs');
const PORT = 4719;
const READY_MS = 120_000;
const SHOTS = process.env.FEEGA_E2E_SHOTS;
const ONBOARDING_MS = 3000;
const COLOUR = '#0078d4';

let appPort = 0;
const STOP_MS = 20_000;
const POLL_MS = 250;

const accepts = (port) =>
  new Promise((done) => {
    const socket = connect({ host: '127.0.0.1', port });
    socket.once('connect', () => (socket.destroy(), done(true)));
    socket.once('error', () => done(false));
  });

async function stopped(cli) {
  const exited = new Promise((done) => cli.once('exit', done));
  cli.stdin.end();
  await Promise.race([exited, new Promise((done) => setTimeout(done, STOP_MS))]);
  assert.ok(cli.exitCode !== null, 'the CLI exits when told to stop');
  const end = Date.now() + STOP_MS;
  while (appPort && (await accepts(appPort)) && Date.now() < end) {
    await new Promise((done) => setTimeout(done, POLL_MS));
  }
  assert.ok(!appPort || !(await accepts(appPort)), `no dev server left on ${appPort}`);
}

function started() {
  const cli = spawn(process.execPath, [CLI, APP, '--port', String(PORT), '--no-open'], { stdio: ['pipe', 'pipe', 'inherit'], env: { ...process.env, FEEGA_STOP_ON_STDIN_END: '1' } });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('the editor did not start')), READY_MS);
    cli.stdout.on('data', (data) => {
      process.stdout.write(data);
      const text = String(data);
      appPort ||= Number(/app on https?:\/\/[^:/\s]+:(\d+)/.exec(text)?.[1] ?? 0);
      const url = /editor ready on (\S+)/.exec(text)?.[1];
      if (url) {
        clearTimeout(timer);
        resolve({ cli, url });
      }
    });
    cli.once('exit', () => reject(new Error('the CLI exited before it was ready')));
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
  await page.getByRole('alertdialog').waitFor({ timeout: ONBOARDING_MS }).then(() => page.keyboard.press('Escape'), () => undefined);
  await page.getByRole('alertdialog').waitFor({ state: 'detached' });
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
  assert.ok(changed.length > 0, 'a file changes');
  restore = () => execFileSync('git', ['-C', APP, 'checkout', '--', ...changed]);
  const added = changed.flatMap(diffOf).filter((line) => line.startsWith('+') && !line.startsWith('+++'));
  const written = added.find((line) => /0078d4/i.test(line));
  assert.ok(written, `the colour is written to ${changed.join(', ')}:\n${added.join('\n')}`);

  await page.getByRole('button', { name: /^Undo/ }).first().click();
  await page.waitForTimeout(1500);
  assert.deepEqual(changedFiles(), [], 'undo restores the file');
  restore = null;
  console.log(`FEEGA_NPX_E2E_OK ${changed.join(',')} ${written.trim()}`);
} finally {
  restore?.();
  rmSync(join(APP, '.feega'), { recursive: true, force: true });
  await browser.close();
}
await stopped(cli);
console.log(`FEEGA_NPX_STOPPED_CLEAN ${appPort}`);
