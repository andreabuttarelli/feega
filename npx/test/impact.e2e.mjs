import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const APP = resolve(process.env.FEEGA_E2E_APP);
const CLI = here('../dist/cli.cjs');
const PORT = Number(process.env.FEEGA_E2E_PORT ?? 4731);
const READY_MS = 120_000;
const SETTLE_MS = 2500;
const ONBOARDING_MS = 10_000;
const LABEL_MS = 15_000;
const CODE_BINARIES = ['code', 'code.cmd'];
const SHOTS = process.env.FEEGA_E2E_SHOTS ?? join(homedir(), 'Documents/feega-videos/impact-label');
const APP_FILE = join(APP, 'src/App.jsx');
const CSS_FILE = join(APP, 'src/impact.css');
const CSS_BEFORE = '.impact-lead {\n  color: #333;\n}\n';
const LEAD_BEFORE = '<p className={styles.lead}>';
const LEAD_AFTER = '<p id="lead" className="impact-lead">';
const IMPORT_AFTER = "import styles from './App.module.css';";
const PADDING = '[data-row="padding"] input[aria-label="padding-all"]';

const git = (...args) => execFileSync('git', ['-C', APP, ...args], { encoding: 'utf8' });
const changedFiles = () => git('diff', '--name-only', '--relative').split('\n').filter(Boolean);

const pathWithoutCode = () => (process.env.PATH ?? '').split(delimiter).filter((dir) => !CODE_BINARIES.some((name) => existsSync(join(dir, name)))).join(delimiter);

function started() {
  const env = { ...process.env, FEEGA_STOP_ON_STDIN_END: '1' };
  if (process.platform !== 'win32') {
    env.PATH = pathWithoutCode();
  }
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

const sourceBefore = readFileSync(APP_FILE, 'utf8');
assert.ok(sourceBefore.includes(LEAD_BEFORE), 'the fixture still has the lead paragraph');
writeFileSync(APP_FILE, sourceBefore.replace(LEAD_BEFORE, LEAD_AFTER).replace(IMPORT_AFTER, `${IMPORT_AFTER}\nimport './impact.css';`));
writeFileSync(CSS_FILE, CSS_BEFORE);
mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = async (name, run) => {
  try {
    await run();
    results.push(`PASS ${name}`);
  } catch (error) {
    results.push(`FAIL ${name}: ${String(error.message).split('\n').slice(0, 6).join(' | ')}`);
  }
};

const { cli, url } = await started();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  await page.goto(url);
  const frame = page.frameLocator('[data-testid="app-frame"]');
  await page.getByText('Click an element to edit it').waitFor({ timeout: READY_MS });
  await page.getByRole('alertdialog').waitFor({ timeout: ONBOARDING_MS }).then(() => page.getByTestId('onboarding-close').click(), () => undefined);
  await page.getByRole('alertdialog').waitFor({ state: 'detached' });
  await page.getByTestId('address').fill('/');
  await page.getByTestId('address').press('Enter');
  await page.waitForTimeout(SETTLE_MS);

  const label = page.getByTestId('impact');
  const settled = async (selector, wanted) => {
    await frame.locator(selector).first().click();
    await page.waitForFunction((text) => (document.querySelector('[data-testid="impact"]')?.textContent ?? '').includes(text), wanted, { timeout: LABEL_MS });
    return { tone: await label.getAttribute('data-tone'), text: (await label.innerText()).replace(/\s+/g, ' ').trim() };
  };
  const shot = (name) => page.screenshot({ path: join(SHOTS, name) });
  const written = () => [...changedFiles().filter((file) => file !== 'src/App.jsx'), ...(readFileSync(CSS_FILE, 'utf8') === CSS_BEFORE ? [] : ['src/impact.css'])];

  await check('an element of the page says it stays local', async () => {
    const found = await settled('#title', 'This element only');
    assert.equal(found.tone, 'local');
    assert.equal(found.text, 'This element only');
    await shot('1-local.png');
  });

  await check('a shared component names itself and counts its files, and the count opens the list', async () => {
    const found = await settled('#benefits', 'component');
    assert.equal(found.tone, 'shared');
    assert.match(found.text, /^Benefits component · used in \d+ files?/);
    await page.locator('[data-action="impact-files"]').click();
    const listed = await page.getByTestId('impact-files').innerText();
    assert.match(listed, /src\/App\.jsx:\d+/);
    await shot('2-component.png');
  });

  await check('an unknown impact shows a diff first: Cancel writes nothing', async () => {
    const found = await settled('#lead', 'Impact unknown');
    assert.equal(found.tone, 'unknown');
    assert.equal(found.text, 'Impact unknown');
    const field = page.locator(PADDING);
    await field.waitFor({ timeout: LABEL_MS });
    await field.fill('20');
    await field.press('Enter');
    await page.getByTestId('impact-preview').waitFor({ timeout: LABEL_MS });
    assert.deepEqual(written(), [], 'nothing is written while the preview is open');
    await shot('3-unknown.png');
    await page.locator('[data-action="preview-cancel"]').click();
    await page.getByTestId('impact-preview').waitFor({ state: 'detached' });
    await page.waitForTimeout(SETTLE_MS);
    assert.deepEqual(written(), [], 'Cancel leaves the source as it was');
  });

  await check('Apply writes what the preview showed', async () => {
    await settled('#lead', 'Impact unknown');
    const field = page.locator(PADDING);
    await field.fill('20');
    await field.press('Enter');
    await page.getByTestId('impact-preview').waitFor({ timeout: LABEL_MS });
    await page.locator('[data-action="preview-apply"]').click();
    await page.getByTestId('impact-preview').waitFor({ state: 'detached' });
    await page.waitForTimeout(SETTLE_MS);
    assert.ok(written().length > 0, 'Apply wrote a file');
    await page.getByRole('button', { name: /^Undo/ }).first().click();
    await page.waitForTimeout(SETTLE_MS);
    assert.deepEqual(written(), [], 'one undo restores it');
  });
} finally {
  await browser.close();
  cli.kill();
  writeFileSync(APP_FILE, sourceBefore);
  rmSync(CSS_FILE, { force: true });
}

console.log(results.join('\n'));
if (results.some((line) => line.startsWith('FAIL'))) {
  process.exitCode = 1;
}
