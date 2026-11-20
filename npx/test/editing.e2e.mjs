import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const APP = resolve(process.env.FEEGA_E2E_APP);
const CLI = here('../dist/cli.cjs');
const PORT = Number(process.env.FEEGA_E2E_PORT ?? 4721);
const READY_MS = 120_000;
const SETTLE_MS = 2500;
const TAILWIND = /tailwind/.test(APP);
const ONBOARDING_MS = 3000;
const NEW_TITLE = 'Ship faster than planned';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const MAX_UNDOS = 10;
const IMAGE_DIRS = ['public/images', 'static/images'];

const git = (...args) => execFileSync('git', ['-C', APP, ...args], { encoding: 'utf8' });
const changedFiles = () => git('diff', '--name-only', '--relative').split('\n').filter(Boolean);
const diffText = () => git('diff', '--relative');
const untracked = () => git('ls-files', '--others', '--exclude-standard', '--', '.').split('\n').filter((f) => f && !f.startsWith('node_modules') && !f.startsWith('.feega'));

function started() {
  const cli = spawn(process.execPath, [CLI, APP, '--port', String(PORT), '--no-open'], { stdio: ['pipe', 'pipe', 'inherit'], env: { ...process.env, FEEGA_STOP_ON_STDIN_END: '1' } });
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

const { cli, url } = await started();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  await page.goto(url);
  const frame = page.frameLocator('[data-testid="app-frame"]');
  await page.getByText('Click an element to edit it').waitFor({ timeout: READY_MS });
  await page.getByRole('alertdialog').waitFor({ timeout: ONBOARDING_MS }).then(() => page.keyboard.press('Escape'), () => undefined);
  await page.getByRole('alertdialog').waitFor({ state: 'detached' });
  await page.waitForTimeout(SETTLE_MS);
  const undo = async () => {
    await page.getByRole('button', { name: /^Undo/ }).first().click();
    await page.waitForTimeout(SETTLE_MS);
  };

  const opened = async (locator) => {
    const box = await locator.boundingBox();
    await page.mouse.dblclick(box.x + 20, box.y + box.height / 2);
    await frame.locator('[contenteditable]').first().waitFor({ timeout: 5000 });
  };

  await check('layers tree is filled on first load', async () => {
    const rows = await page.locator('[data-testid="layers"] [data-layer]').count();
    assert.ok(rows >= 3, `only ${rows} layer rows`);
  });

  await check('layers expand to the selected element', async () => {
    await frame.locator('h1').first().click();
    await page.waitForTimeout(800);
    const picked = await page.locator('[data-testid="layers"] [data-layer][aria-selected="true"]').count();
    assert.equal(picked, 1, 'the selected element has a visible layer row');
  });

  await check('plain text edit writes the source and undo restores it', async () => {
    const h1 = frame.locator('h1').first();
    await h1.click();
    await opened(h1);
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type(NEW_TITLE);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(SETTLE_MS);
    assert.ok(diffText().includes(NEW_TITLE), `the new title is in the source; page says: ${(await page.locator('body').innerText()).slice(0, 400).replace(/\n/g, ' | ')} h1=${await frame.locator('h1').first().innerText()}`);
    await undo();
    assert.deepEqual(changedFiles(), [], 'one undo restores the source');
  });

  await check('text from a prop is refused and the preview keeps the old text', async () => {
    const h2 = frame.locator('h2').first();
    const was = await h2.innerText();
    await h2.click();
    await opened(h2);
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Changed from the preview');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(SETTLE_MS);
    assert.equal(await frame.locator('h2').first().innerText(), was, 'the preview text diverged from the source');
    assert.deepEqual(changedFiles(), [], 'the source was not touched');
  });

  await check('padding on all sides writes one shorthand (css) and one undo reverts', async () => {
    await frame.locator('h1').first().click();
    const field = page.locator('[data-row="padding"] input[aria-label="padding-all"]');
    await field.waitFor({ timeout: 10_000 });
    await field.fill('20');
    await field.press('Enter');
    await page.waitForTimeout(SETTLE_MS);
    const added = diffText().split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'));
    assert.ok(added.length > 0, 'something was written');
    if (!TAILWIND) {
      assert.ok(added.some((l) => /padding:\s*20px/.test(l)), `shorthand padding:\n${added.join('\n')}`);
      assert.ok(!added.some((l) => /padding-(top|left)/.test(l)), 'no longhands');
    }
    await undo();
    assert.deepEqual(changedFiles().concat(untracked()), [], 'one undo restores everything');
  });

  await check('a fill colour does not add background-image none', async () => {
    await frame.locator('h1').first().click();
    const hex = page.locator('[data-row="fill"] input[aria-label="Colour hex"]').first();
    if (!(await hex.count())) {
      const add = page.locator('[data-section="Fill"] button[aria-label*="Add"]').first();
      await add.click();
    }
    await page.waitForTimeout(SETTLE_MS);
    assert.ok(!diffText().includes('background-image'), 'no background-image written');
    if (changedFiles().length) {
      await undo();
    }
  });

  const undoAll = async () => {
    for (let n = 0; n < MAX_UNDOS && changedFiles().length; n++) {
      await undo();
    }
  };

  await check('image fill: choosing a file copies it to the public folder, writes its url, and undo clears the css', async () => {
    await frame.locator('h1').first().click();
    await page.locator('[data-section="Fill"] button[aria-label="Add fill"]').click();
    await page.waitForTimeout(SETTLE_MS);
    await page.locator('[data-row="fill-0"] .swatch-button').click();
    await page.locator('select[aria-label="Fill type"]').selectOption('image');
    const picture = join(mkdtempSync(join(tmpdir(), 'feega-img-')), 'e2e-photo.png');
    writeFileSync(picture, PNG);
    const chooser = page.waitForEvent('filechooser');
    await page.locator('[data-field="choose-image"]').click();
    await (await chooser).setFiles(picture);
    await page.waitForTimeout(SETTLE_MS);
    const copied = IMAGE_DIRS.map((dir) => join(APP, dir, 'e2e-photo.png')).find((path) => existsSync(path));
    assert.ok(copied, 'the file landed in the public folder');
    assert.ok(diffText().includes(TAILWIND ? 'bg-[url(/images/e2e-photo.png)]' : 'url("/images/e2e-photo.png")'), `the url is written:\n${diffText()}`);
    assert.ok(diffText().includes(TAILWIND ? '[background-size:cover]' : 'background-size: cover'), 'size is written');
    await page.keyboard.press('Escape');
    await undoAll();
    assert.deepEqual(changedFiles(), [], 'undo restores the stylesheet or class');
  });

  await check('text gradient: layers clip the background to the text, removing them restores the colour', async () => {
    await frame.locator('h1').first().click();
    const section = page.locator('[data-section="Typography"]');
    await section.locator('button[aria-label="Add fill"]').click();
    await page.waitForTimeout(SETTLE_MS);
    await section.locator('[data-row="text-fill-0"] .swatch-button').click();
    await page.locator('select[aria-label="Fill type"]').selectOption('linear');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(SETTLE_MS);
    const diff = diffText();
    assert.ok(TAILWIND ? diff.includes('bg-clip-text') && diff.includes('text-transparent') : diff.includes('background-clip: text') && diff.includes('-webkit-background-clip: text') && diff.includes('color: transparent'), `clip written:\n${diff}`);
    const clip = await frame.locator('h1').first().evaluate((h) => getComputedStyle(h).webkitBackgroundClip);
    assert.equal(clip, 'text', 'the page shows the clipped text');
    await section.locator('[data-row="text-fill-0"] button[aria-label="Remove fill"]').click();
    await page.waitForTimeout(SETTLE_MS);
    assert.ok(!/background-clip|bg-clip/.test(diffText()), `clip dropped:\n${diffText()}`);
    await undoAll();
    assert.deepEqual(changedFiles(), [], 'undo restores everything');
  });

  await check('sibling reorder writes the source, shows in the preview, and undo restores it', async () => {
    await frame.locator('h1').first().click();
    await page.waitForTimeout(800);
    const layers = page.locator('[data-testid="layers"] [data-layer]');
    const title = layers.filter({ hasText: /^\s*h1/ }).first();
    const lead = layers.filter({ hasText: /^\s*p(\b|\.|_)/ }).first();
    await title.dragTo(lead, { targetPosition: { x: 60, y: 20 } });
    await page.waitForTimeout(SETTLE_MS);
    assert.ok(changedFiles().length > 0, 'the source order changed');
    const order = await frame.locator('main').first().evaluate((main) => [...main.children].map((c) => c.tagName));
    assert.ok(order.indexOf('P') < order.indexOf('H1'), `the preview order is ${order.join(',')}`);
    await undo();
    assert.deepEqual(changedFiles(), [], 'undo restores the order');
  });

  const paragraphs = () => frame.locator('main > p').count();

  await check('delete removes the selected element from the source and the page, and one undo restores it', async () => {
    const before = await paragraphs();
    await frame.locator('main > p').first().click();
    await page.waitForTimeout(800);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(SETTLE_MS);
    assert.ok(changedFiles().length > 0, 'the source changed');
    assert.equal(await paragraphs(), before - 1, 'the paragraph left the page');
    await undo();
    assert.deepEqual(changedFiles(), [], 'undo restores the element');
  });

  await check('duplicate copies the selected element in the source and the page, and one undo restores it', async () => {
    const before = await paragraphs();
    await frame.locator('main > p').first().click();
    await page.waitForTimeout(800);
    await page.keyboard.press('ControlOrMeta+d');
    await page.waitForTimeout(SETTLE_MS);
    assert.equal(await paragraphs(), before + 1, 'the paragraph was copied');
    await undo();
    assert.deepEqual(changedFiles(), [], 'undo restores the page');
  });

  await check('the context menu deletes the element', async () => {
    const before = await paragraphs();
    await frame.locator('main > p').first().click({ button: 'right' });
    await page.getByTestId('structure-menu').getByRole('menuitem', { name: /Delete/ }).click();
    await page.waitForTimeout(SETTLE_MS);
    assert.equal(await paragraphs(), before - 1, 'the paragraph left the page');
    await undo();
    assert.deepEqual(changedFiles(), [], 'undo restores the element');
  });

  await check('dragging a layer onto another container moves it there, keeps its classes, and one undo restores it', async () => {
    await frame.locator('h1').first().click();
    await page.waitForTimeout(800);
    const layers = page.locator('[data-testid="layers"] [data-layer]');
    const title = layers.filter({ hasText: /^\s*h1/ }).first();
    const grid = layers.filter({ hasText: /^\s*section/ }).first();
    const classes = await frame.locator('h1').first().getAttribute('class');
    await title.dragTo(grid, { targetPosition: { x: 60, y: 13 } });
    await page.waitForTimeout(SETTLE_MS);
    assert.equal(await frame.locator('section > h1').count(), 1, 'the title is inside the section');
    assert.equal(await frame.locator('section > h1').first().getAttribute('class'), classes, 'the classes travelled with it');
    await undo();
    assert.deepEqual(changedFiles(), [], 'undo restores the page');
  });

  await check('dragging on the page drops an element inside a container, shows the orange outline, and one undo restores it', async () => {
    const lead = frame.locator('main > p').first();
    await lead.click();
    await page.waitForTimeout(800);
    const from = await lead.boundingBox();
    const to = await frame.locator('section').first().boundingBox();
    await page.mouse.move(from.x + 10, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
    await page.waitForTimeout(500);
    assert.ok(await page.locator('.drop-line.box').count(), 'the container is outlined');
    await page.mouse.up();
    await page.waitForTimeout(SETTLE_MS);
    assert.equal(await frame.locator('section > p').count(), 1, 'the paragraph is inside the section');
    await undo();
    assert.deepEqual(changedFiles(), [], 'undo restores the page');
  });

  await check('position: absolute and top write the source and the page, the layer is tagged, and each edit is one undo', async () => {
    const h1 = frame.locator('h1').first();
    await h1.click();
    const section = page.locator('[data-section="Position"]');
    await section.waitFor({ timeout: 10_000 });
    if ((await section.locator('[data-row="position"]').count()) === 0) {
      await section.locator('button.title').click();
    }
    assert.equal(await section.locator('[data-row="top"]').count(), 0, 'a static element hides the offsets');
    await section.locator('[data-field="position"]').click();
    await page.getByRole('option', { name: 'absolute' }).click();
    await page.waitForTimeout(SETTLE_MS);
    assert.ok(diffText().includes(TAILWIND ? 'absolute' : 'position: absolute'), `position written:\n${diffText()}`);
    assert.equal(await h1.evaluate((e) => getComputedStyle(e).position), 'absolute', 'the page shows the position');
    const top = section.locator('input[aria-label="top"]');
    await top.waitFor({ timeout: 10_000 });
    await top.fill('12');
    await top.press('Enter');
    await page.waitForTimeout(SETTLE_MS);
    assert.ok(diffText().includes(TAILWIND ? 'top-3' : 'top: 12px'), `top written:\n${diffText()}`);
    assert.equal(await h1.evaluate((e) => getComputedStyle(e).top), '12px', 'the page shows the offset');
    await page.waitForTimeout(800);
    const tagged = await page.locator('[data-testid="layers"] [data-layer][aria-selected="true"] [data-float="absolute"]').count();
    assert.equal(tagged, 1, 'the layer carries the absolute tag');
    await undo();
    assert.ok(!/top-3|top:\s*12px/.test(diffText()) && /absolute/.test(diffText()), 'one undo removes only the offset');
    await undo();
    assert.deepEqual(changedFiles(), [], 'a second undo restores the source');
  });

  await check('no package file was created or changed', async () => {
    assert.deepEqual(untracked().filter((f) => /package-lock|pnpm-lock|yarn\.lock|bun\.lock/.test(f)), []);
    assert.ok(!changedFiles().some((f) => /package/.test(f)));
  });
} finally {
  const left = changedFiles();
  if (left.length) {
    git('checkout', '--', ...left);
  }
  rmSync(join(APP, '.feega'), { recursive: true, force: true });
  IMAGE_DIRS.forEach((dir) => rmSync(join(APP, dir, 'e2e-photo.png'), { force: true }));
  await browser.close();
  cli.stdin.end();
}
console.log(`\n${APP}\n${results.join('\n')}`);
process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
void existsSync;
void readFileSync;
