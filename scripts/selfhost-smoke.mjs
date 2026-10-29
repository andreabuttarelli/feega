import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const APP_URL = (process.env.PUBLIC_APP_URL || 'http://localhost:5173').replace(/\/$/, '');
const EMAIL = process.env.SEED_DEMO_EMAIL || 'demo@feega.local';
const PASSWORD = process.env.SEED_DEMO_PASSWORD || 'feega-demo-2026';
const CANVAS_PATH = process.env.SMOKE_CANVAS_PATH;
const SHOT_DIR = process.env.SMOKE_SHOT_DIR || '.';
const VIEWPORT = { width: 1440, height: 900 };
const HYDRATE_MS = 30_000;
const EXPORT_MS = 120_000;
const SETTLE_MS = 4000;
const SHAPE_SETTLE_MS = 2500;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
const KEYFRAMES_PER_ANIMATION = 2;
const FRAME_DRAG = { from: { x: 100, y: 120 }, to: { x: 340, y: 270 } };
const SHAPE_IN_FRAME = { from: { x: 0.2, y: 0.25 }, to: { x: 0.6, y: 0.75 } };
const FRAME_CORNER_INSET = 6;
const EMPTY_POINT = { x: 700, y: 150 };
const TOUR_SEEN_KEY = 'feega:tour-seen';
const KNOWN_PAGE_ERRORS = [/did not match any routes/, /sandboxed and lacks the 'allow-same-origin'/];

const timings = [];
const pageErrors = [];
const networkErrors = [];

async function step(name, fn) {
  const started = Date.now();
  await fn();
  timings.push(`${name}: ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(`ok  ${timings.at(-1)}`);
}

async function drag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}

async function login(page) {
  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle' });
  await page.getByPlaceholder('you@yourbrand.com').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  const answered = page.waitForResponse((r) => r.url().includes('/login?/login') && r.request().method() === 'POST', { timeout: HYDRATE_MS });
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await answered;
  await page.waitForURL(/\/(app|p\/)/, { timeout: HYDRATE_MS });
}

async function openDemoCanvas(page) {
  const target = CANVAS_PATH ?? (await page.locator('a[href^="/p/"][href*="/c/"]').first().getAttribute('href'));
  await page.goto(`${APP_URL}${target}`, { waitUntil: 'networkidle' });
  await page.getByTestId('core-canvas').waitFor({ timeout: HYDRATE_MS });
  await page.waitForTimeout(SETTLE_MS);
  if ((await page.getByTestId('gpu-node').count()) < 1) {
    throw new Error('the demo canvas has no frame');
  }
}

async function openBlankCanvas(page) {
  await page.goto(`${APP_URL}/app`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'new canvas' }).click();
  await page.waitForURL(/\/p\/.+\/c\//, { timeout: HYDRATE_MS });
  await page.getByTestId('core-canvas').waitFor({ timeout: HYDRATE_MS });
  await page.waitForTimeout(SETTLE_MS);
}

async function createFrame(page) {
  const before = await page.getByTestId('gpu-node').count();
  await page.locator('button[data-tool="frame"]').click();
  await drag(page, FRAME_DRAG.from, FRAME_DRAG.to);
  await page.waitForFunction((n) => document.querySelectorAll('[data-testid="gpu-node"]').length > n, before, { timeout: HYDRATE_MS });
  await page.waitForTimeout(SHAPE_SETTLE_MS);
}

async function frameBox(page) {
  const box = await page.getByTestId('gpu-node').last().boundingBox();
  if (!box) {
    throw new Error('the new frame has no bounding box');
  }
  return box;
}

async function drawShape(page) {
  const box = await frameBox(page);
  const at = (fx, fy) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });
  await page.locator('button[data-tool="rectangle"]').click();
  await drag(page, at(SHAPE_IN_FRAME.from.x, SHAPE_IN_FRAME.from.y), at(SHAPE_IN_FRAME.to.x, SHAPE_IN_FRAME.to.y));
  await page.getByTestId('frame-timeline').waitFor({ timeout: HYDRATE_MS });
  await page.getByTestId('motion-inspector').waitFor({ timeout: HYDRATE_MS });
  await page.waitForTimeout(SHAPE_SETTLE_MS);
}

async function animateShape(page) {
  const animation = page.locator('[data-section="animate"] .section-head');
  if ((await animation.count()) === 0) {
    await page.getByTestId('frame-timeline-mode').click();
  }
  await animation.scrollIntoViewIfNeeded();
  if ((await animation.getAttribute('aria-expanded')) === 'false') {
    await animation.click();
  }
  const section = page.getByTestId('animate-to');
  await section.scrollIntoViewIfNeeded();
  await section.getByLabel('Animate property').selectOption('opacity');
  await section.getByLabel('Animate target').fill('0');
  await section.getByLabel('Animate length').fill('1');
  await section.getByTestId('animate-to-run').click();
  await page.getByRole('button', { name: 'Show keyframes' }).first().click();
  const keyframes = page.getByRole('button', { name: /^Opacity keyframe at / });
  await keyframes.first().waitFor({ timeout: HYDRATE_MS });
  const count = await keyframes.count();
  if (count !== KEYFRAMES_PER_ANIMATION) {
    throw new Error(`expected ${KEYFRAMES_PER_ANIMATION} opacity keyframes, got ${count}`);
  }
}

async function exportStill(page) {
  await page.mouse.click(EMPTY_POINT.x, EMPTY_POINT.y);
  const box = await frameBox(page);
  await page.mouse.click(box.x + FRAME_CORNER_INSET, box.y + FRAME_CORNER_INSET, { button: 'right' });
  await page.getByRole('menuitem', { name: /Export/ }).click();
  const dialog = page.getByTestId('export-dialog');
  await dialog.waitFor({ timeout: HYDRATE_MS });
  const imageChoice = dialog.getByRole('button', { name: /Image files/ });
  await imageChoice.or(page.getByTestId('export-go')).first().waitFor({ timeout: HYDRATE_MS });
  if (await imageChoice.isVisible()) {
    await imageChoice.click();
  }
  await page.getByTestId('export-go').click();
  const link = page.getByTestId('export-file');
  await link.or(dialog.getByRole('alert')).waitFor({ timeout: EXPORT_MS });
  if ((await dialog.getByRole('alert').count()) > 0) {
    throw new Error(`export failed: ${await dialog.getByRole('alert').innerText()}`);
  }
  const bytes = new Uint8Array(await (await page.request.get(await link.getAttribute('href'))).body());
  if (!PNG_MAGIC.every((byte, i) => bytes[i] === byte)) {
    throw new Error('exported file is not a PNG');
  }
  writeFileSync(`${SHOT_DIR}/smoke-still.png`, bytes);
  console.log(`    still: ${bytes.length} bytes`);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.addInitScript((tourKey) => {
    localStorage.setItem(tourKey, '1');
  }, TOUR_SEEN_KEY);
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => msg.type() === 'error' && networkErrors.push(`console: ${msg.text().slice(0, 200)}`));
  page.on('requestfailed', (request) => networkErrors.push(`failed: ${request.url().slice(0, 160)} ${request.failure()?.errorText}`));
  page.on('response', async (response) => {
    if (response.status() >= 500) {
      networkErrors.push(`${response.status()}: ${response.url().slice(0, 100)} ${(await response.text().catch(() => '')).slice(0, 400)}`);
    }
  });
  await page.addLocatorHandler(page.getByTestId('cookie-banner'), () => page.getByTestId('cookie-reject').click());

  try {
    await step('login', () => login(page));
    await step('open demo canvas', () => openDemoCanvas(page));
    await step('open blank canvas', () => openBlankCanvas(page));
    await step('create frame', () => createFrame(page));
    await step('draw shape', () => drawShape(page));
    await page.screenshot({ path: `${SHOT_DIR}/smoke-drawn.png` });
    await step('animate (2 keyframes)', () => animateShape(page));
    await page.screenshot({ path: `${SHOT_DIR}/smoke-animated.png` });
    await step('export still (PNG)', () => exportStill(page));
  } catch (error) {
    await page.screenshot({ path: `${SHOT_DIR}/smoke-failed.png` });
    console.log(networkErrors.slice(-12).join('\n'));
    throw error;
  } finally {
    await browser.close();
  }

  const unexpected = pageErrors.filter((message) => !KNOWN_PAGE_ERRORS.some((known) => known.test(message)));
  console.log(`\npage errors (unexpected): ${unexpected.length}`);
  for (const message of unexpected) {
    console.log(`  ${message.slice(0, 200)}`);
  }
}

main().catch((err) => {
  console.error(`FAILED: ${err.message}`);
  process.exit(1);
});
