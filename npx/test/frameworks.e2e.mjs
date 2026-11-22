import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const APP = resolve(process.env.FEEGA_E2E_APP);
const WRITTEN_FILE = {
  'vite-vanilla': /(^|\/)index\.html$/,
  'astro-css': /(^|\/)index\.astro$/,
  'nuxt-css': /(^|\/)app\/app\.vue$/,
  'react-router-css': /(^|\/)routes\/home\.tsx$/
};
const SOURCE_FILE = WRITTEN_FILE[basename(APP)] ?? /src\//;
const CLI = here('../dist/cli.cjs');
const PORT = Number(process.env.FEEGA_E2E_PORT ?? 4723);
const READY_MS = 180_000;
const SETTLE_MS = 2500;
const ONBOARDING_MS = 10_000;
const NEW_TITLE = 'Ship faster than planned';
const COLOUR = '#0078d4';

const git = (...args) => execFileSync('git', ['-C', APP, ...args], { encoding: 'utf8' });
const changedFiles = () => git('diff', '--name-only', '--relative').split('\n').filter(Boolean);
const diffText = () => git('diff', '--relative');
const untracked = () => git('ls-files', '--others', '--exclude-standard', '--', '.').split('\n').filter((f) => f && !f.startsWith('node_modules') && !f.startsWith('.feega'));
const created = new Set(untracked());
const newFiles = () => untracked().filter((f) => !created.has(f));
const writtenText = () => diffText() + newFiles().map((f) => readFileSync(join(APP, f), 'utf8')).join('\n');

function started() {
  const env = { ...process.env, FEEGA_STOP_ON_STDIN_END: '1' };
  const cli = spawn(process.execPath, [CLI, APP, '--port', String(PORT), '--no-open'], { stdio: ['pipe', 'pipe', 'inherit'], env });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('the editor did not start')), READY_MS);
    cli.stdout.on('data', (data) => {
      const url = /editor ready on (\S+)/.exec(String(data))?.[1];
      if (url) {
        clearTimeout(timer);
        resolve({ cli, url });
      }
    });
    cli.once('exit', () => reject(new Error('the CLI exited before it was ready')));
  });
}

const results = [];
const check = async (name, run) => {
  try {
    await run();
    results.push(`PASS ${name}`);
  } catch (error) {
    results.push(`FAIL ${name}: ${String(error.message).split('\n')[0]}`);
  }
};

let cli;
let browser;
try {
  const launched = await started();
  cli = launched.cli;
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  await page.goto(launched.url);
  const frame = page.frameLocator('[data-testid="app-frame"]');
  await page.getByText('Click an element to edit it').waitFor({ timeout: READY_MS });
  await page.getByRole('alertdialog').waitFor({ timeout: ONBOARDING_MS }).then(() => page.getByTestId('onboarding-close').click(), () => undefined);
  await page.getByRole('alertdialog').waitFor({ state: 'detached' });
  await page.waitForTimeout(SETTLE_MS);
  results.push('PASS launch');

  const undo = async () => {
    await page.getByRole('button', { name: /^Undo/ }).first().click();
    await page.waitForTimeout(SETTLE_MS);
  };
  const paragraphs = () => frame.locator('main p').count();

  await check('stamping leaves no attribute text on the page', async () => {
    const text = await frame.locator('body').innerText();
    assert.ok(!text.includes('data-feega'), 'the page shows stamped attributes as text');
  });

  await check('select to source: the picked element has a layer', async () => {
    await frame.locator('h1').first().click();
    await page.waitForTimeout(800);
    assert.equal(await page.locator('[data-testid="layers"] [data-layer][aria-selected="true"]').count(), 1, 'a layer is selected');
  });

  await check('text edit lands in the right file and undo restores it', async () => {
    const h1 = frame.locator('h1').first();
    await h1.click();
    const box = await h1.boundingBox();
    await page.mouse.dblclick(box.x + 20, box.y + box.height / 2);
    await frame.locator('[contenteditable]').first().waitFor({ timeout: 5000 });
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type(NEW_TITLE);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(SETTLE_MS);
    assert.ok(diffText().includes(NEW_TITLE), 'the new title is in the source');
    assert.ok(changedFiles().every((f) => SOURCE_FILE.test(f)), `changed ${changedFiles()} but expected ${SOURCE_FILE}`);
    await undo();
    assert.deepEqual(changedFiles(), [], 'one undo restores the source');
  });

  await check('style edit lands in the right file and undo restores it', async () => {
    await frame.locator('h1').first().click();
    const field = page.locator('[data-row="text-fill-0"] input[aria-label="Fill hex"]');
    await field.waitFor({ timeout: 10_000 });
    await field.fill(COLOUR);
    await field.press('Enter');
    await page.waitForTimeout(SETTLE_MS);
    assert.ok(/0078d4/i.test(writtenText()), 'the colour is in the source');
    assert.ok(changedFiles().length + newFiles().length > 0, 'a file changed');
    await undo();
    assert.deepEqual(changedFiles(), [], 'one undo restores the source');
    newFiles().forEach((f) => rmSync(join(APP, f), { force: true }));
  });

  await check('structure edit: delete removes the element from the right file and undo restores it', async () => {
    const before = await paragraphs();
    await frame.locator('main p').first().click();
    await page.waitForTimeout(800);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(SETTLE_MS);
    assert.ok(changedFiles().length > 0, 'the source changed');
    assert.ok(changedFiles().every((f) => SOURCE_FILE.test(f)), `changed ${changedFiles()} but expected ${SOURCE_FILE}`);
    assert.equal(await paragraphs(), before - 1, 'the paragraph left the page');
    await undo();
    assert.deepEqual(changedFiles(), [], 'undo restores the element');
  });
} catch (error) {
  results.push(`FAIL launch: ${String(error.message).split('\n')[0]}`);
} finally {
  const left = changedFiles();
  if (left.length) {
    git('checkout', '--', ...left);
  }
  newFiles().forEach((f) => rmSync(join(APP, f), { force: true }));
  rmSync(join(APP, '.feega'), { recursive: true, force: true });
  await browser?.close();
  cli?.stdin.end();
}
console.log(`\n${APP}\n${results.join('\n')}`);
process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
