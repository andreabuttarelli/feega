import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const APP = resolve(process.env.FEEGA_E2E_APP);
const CLI = here('../dist/cli.cjs');
const PORT = Number(process.env.FEEGA_E2E_PORT ?? 4721);
const READY_MS = 120_000;
const SETTLE_MS = 2500;
const TAILWIND = /tailwind/.test(APP);
const NEXT = /next/.test(APP);
const HAS_ICON = !TAILWIND || /react/.test(APP);
const ONBOARDING_MS = 10_000;
const NEW_TITLE = 'Ship faster than planned';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const MAX_UNDOS = 10;
const DOT_TRIES = 6;
const DOT_RETRY_MS = 1000;
const IMAGE_DIRS = ['public/images', 'static/images'];
const CODE_BINARIES = ['code', 'code.cmd'];
const HANDLER_ATTRIBUTE = /onClick|onclick|@click/;
const GO_PAGE_CODE = /(goto\(|location\.href = |\$router\.push\()'\/pricing'/;
const OPEN_WAIT_MS = 5000;
const OPEN_POLL_MS = 250;
const OUTLINE_TOLERANCE_PX = 2;
const TITLE_ROW = /^\s*Plan your launch/;
const LEAD_ROW = /^\s*Briefs, timelines/;
const NEW_HEADING_ROW = /^\s*Heading/;
const NEW_CONTAINER_ROW = /^\s*(Stack|Row|Grid|Frame|Page|App)/;
const LINK_CRUMB = /^(Link|Start free|Read docs|Features)/;
const SELECTED_ROW = '[data-testid="layers"] [data-layer][aria-selected="true"]';
const SPACER_PX = 3000;
const CLIENT_PAGE_MS = 60_000;
const TOPICS = ['Briefs', 'Timelines', 'Assets'];
const LOOP_DATA = /(sveltekit|react)-css/.test(APP);
const SITE_LINKS = ['Download', 'Documentation', 'Community', 'Pricing'];
const LINKS_FILE = /src\/(lib\/)?links\.(ts|js)$/;
const DRAG_STEPS = 12;
const printed = [];

const git = (...args) => execFileSync('git', ['-C', APP, ...args], { encoding: 'utf8' });
const changedFiles = () => git('diff', '--name-only', '--relative').split('\n').filter(Boolean);
const diffText = () => git('diff', '--relative');
const untracked = () => git('ls-files', '--others', '--exclude-standard', '--', '.').split('\n').filter((f) => f && !f.startsWith('node_modules') && !f.startsWith('.feega'));

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
      printed.push(String(data));
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
const ONLY = process.env.FEEGA_E2E_ONLY ? new RegExp(process.env.FEEGA_E2E_ONLY) : null;
const check = async (name, run) => {
  if (ONLY && !ONLY.test(name)) {
    return;
  }
  try {
    await run();
    results.push(`PASS ${name}`);
  } catch (error) {
    results.push(`FAIL ${name}: ${String(error.message).split("\n")[0]} @ ${String(error.stack).split("\n").find((l) => l.includes("editing.e2e"))}`);
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

  await page.getByTestId('address').fill('/');
  await page.getByTestId('address').press('Enter');
  await page.waitForTimeout(SETTLE_MS);

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

  const layerRow = (pattern) => page.locator('[data-testid="layers"] [data-layer]').filter({ hasText: pattern }).first();
  const rowOfElement = async (element, position) => {
    await element.click({ position });
    await page.waitForTimeout(800);
    const id = await page.locator(SELECTED_ROW).first().getAttribute('data-layer');
    return page.locator(`[data-testid="layers"] [data-layer=${JSON.stringify(id)}]`);
  };
  const sameBox = (a, b, what) => {
    for (const side of ['x', 'y', 'width', 'height']) {
      assert.ok(Math.abs(a[side] - b[side]) <= OUTLINE_TOLERANCE_PX, `${what} ${side}: outline ${a[side]} vs element ${b[side]}`);
    }
  };
  const outlinesElement = async (row, target, outline) => {
    await page.mouse.move(0, 0);
    await row.hover();
    await page.locator(`.outline.${outline}`).waitFor({ timeout: OPEN_WAIT_MS });
    sameBox(await page.locator(`.outline.${outline}`).first().boundingBox(), await target.boundingBox(), `${outline} outline`);
  };

  await check('hovering a layer outlines the element on the page; clicking it selects it and the selection box matches its rect', async () => {
    await frame.locator('h1').first().click();
    await page.waitForTimeout(800);
    await outlinesElement(layerRow(TITLE_ROW), frame.locator('h1').first(), 'hover');
    await layerRow(TITLE_ROW).click();
    await outlinesElement(layerRow(TITLE_ROW), frame.locator('h1').first(), 'picked');
    await page.mouse.move(0, 0);
    assert.equal(await page.locator('.outline.hover').count(), 0, 'the hover outline goes away with the pointer');
  });

  await check('a component layer outlines and selects its root element', async () => {
    await frame.locator('#benefits').click();
    await page.waitForTimeout(800);
    await outlinesElement(layerRow(/^\s*Benefits/), frame.locator('#benefits'), 'hover');
    await layerRow(/^\s*Benefits/).click();
    await outlinesElement(layerRow(/^\s*Benefits/), frame.locator('#benefits'), 'picked');
  });

  await check('a repeated loop layer outlines and selects its first instance', async () => {
    await frame.locator('#topics > *').first().click();
    await page.waitForTimeout(800);
    const row = page.locator('[data-testid="layers"] [data-layer]').filter({ hasText: /×3/ }).first();
    await outlinesElement(row, frame.locator('#topics > *').first(), 'hover');
    await row.click();
    await outlinesElement(row, frame.locator('#topics > *').first(), 'picked');
  });

  await check('selecting a layer below the fold scrolls it into view and draws the selection box', async () => {
    await frame.locator('#topics > *').first().click();
    await page.waitForTimeout(800);
    await frame.locator('#topics').evaluate((list, px) => list.before(Object.assign(document.createElement('div'), { style: `height: ${px}px` })), SPACER_PX);
    const row = page.locator('[data-testid="layers"] [data-layer]').filter({ hasText: /×3/ }).first();
    await row.scrollIntoViewIfNeeded();
    await row.click();
    await page.locator('.outline.picked').waitFor({ timeout: OPEN_WAIT_MS });
    await page.waitForTimeout(800);
    const outline = await page.locator('.outline.picked').first().boundingBox();
    const stage = await page.getByTestId('app-frame').boundingBox();
    assert.ok(outline.y >= stage.y && outline.y + outline.height <= stage.y + stage.height, `selection box ${outline.y} is inside the frame ${stage.y}..${stage.y + stage.height}`);
    sameBox(outline, await frame.locator('#topics > *').first().boundingBox(), 'picked outline');
    await frame.locator('body').evaluate(() => window.scrollTo(0, 0));
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

  await check('responsive: padding at md writes a prefixed class or a min-width rule, the badge names it, one undo reverts', async () => {
    await frame.locator('h1').first().click();
    await page.locator('[data-field="breakpoint"]').waitFor({ timeout: 10_000 });
    await page.locator('[data-field="breakpoint"]').click();
    await page.locator('[data-breakpoint-item="md"]').click();
    assert.equal(await page.getByTestId('breakpoint-badge').innerText(), 'editing: md ≥ 768px');
    const field = page.locator('[data-row="padding"] input[aria-label="padding-all"]');
    await field.fill('20');
    await field.press('Enter');
    await page.waitForTimeout(SETTLE_MS);
    const added = diffText().split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).join('\n');
    assert.ok(TAILWIND ? /md:p-/.test(added) : /@media \(min-width: 768px\)/.test(added), `breakpoint write:\n${added}`);
    await undo();
    assert.deepEqual(changedFiles().concat(untracked()), [], 'one undo restores everything');
    await page.locator('[data-field="breakpoint"]').click();
    await page.locator('[data-breakpoint-item="follow"]').click();
  });

  const chooseState = async (name) => {
    await page.locator('[data-field="state"]').click();
    await page.locator(`[data-state-item="${name}"]`).click();
    await page.waitForTimeout(800);
  };
  const buttonFill = () => frame.locator('#cta').evaluate((el) => getComputedStyle(el).backgroundColor);

  await check('hover state: a background set in Hover writes the hover rule, the forced preview shows it, default is untouched, one undo restores it', async () => {
    await frame.locator('#cta').click();
    await page.waitForTimeout(800);
    const normal = await buttonFill();
    await chooseState('hover');
    assert.ok((await page.getByTestId('breadcrumb').first().innerText()).includes(':hover'), 'the breadcrumb carries the state badge');
    await page.locator('[data-section="Fill"] button[aria-label*="Add"]').first().click();
    await page.waitForTimeout(SETTLE_MS);
    const added = diffText().split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).join('\n');
    assert.ok(TAILWIND ? /hover:bg-\[#d9d9d9\]/.test(added) : /:hover\s*\{/.test(added) && /background(-color)?:\s*#d9d9d9/i.test(added), `the hover declaration is written:\n${added}`);
    assert.equal(await buttonFill(), 'rgb(217, 217, 217)', 'the forced preview shows the hover background');
    await chooseState('default');
    assert.equal(await buttonFill(), normal, 'the default look is untouched');
    let dots = 0;
    for (let tries = 0; tries < DOT_TRIES && !dots; tries++) {
      await page.locator('[data-field="state"]').click();
      dots = await page.locator('[data-state-item="hover"] .dot').count();
      await page.keyboard.press('Escape');
      dots || (await page.waitForTimeout(DOT_RETRY_MS));
    }
    assert.equal(dots, 1, 'hover shows a dot once it has styles');
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
    const title = layers.filter({ hasText: TITLE_ROW }).first();
    const lead = layers.filter({ hasText: LEAD_ROW }).first();
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
    const title = layers.filter({ hasText: TITLE_ROW }).first();
    const section = frame.locator('section#pricing');
    const [outer, first, second] = await Promise.all([section.boundingBox(), section.locator('> article').nth(0).boundingBox(), section.locator('> article').nth(1).boundingBox()]);
    const grid = await rowOfElement(section, { x: (first.x + first.width + second.x) / 2 - outer.x, y: first.y + first.height / 2 - outer.y });
    await frame.locator('h1').first().click();
    await page.waitForTimeout(800);
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
    const [first, second] = await Promise.all([frame.locator('section > article').nth(0).boundingBox(), frame.locator('section > article').nth(1).boundingBox()]);
    const gap = { x: (first.x + first.width + second.x) / 2, y: first.y + first.height / 2 };
    await page.mouse.move(from.x + 10, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(gap.x, gap.y, { steps: 12 });
    await page.waitForTimeout(500);
    assert.ok(await page.locator('.drop-line.box').count(), 'the container is outlined');
    await page.mouse.up();
    await page.waitForTimeout(SETTLE_MS);
    assert.equal(await frame.locator('section > p').count(), 1, 'the paragraph is inside the section');
    await undo();
    assert.deepEqual(changedFiles(), [], 'undo restores the page');
  });

  await check('Add inserts a heading after the selected element with the project styling, selects it, and one undo removes it', async () => {
    await frame.locator('h1').first().click();
    await page.waitForTimeout(800);
    await page.keyboard.press('/');
    await page.getByTestId('add-menu').getByRole('menuitem', { name: 'Heading' }).click();
    await page.waitForTimeout(SETTLE_MS);
    assert.equal(await frame.locator('main > h2').count(), 1, 'the heading is on the page');
    assert.ok(/text-2xl|font-size|fontSize/.test(diffText()), 'the heading carries minimal styling');
    const picked = await page.locator('[data-testid="layers"] [data-layer][aria-selected="true"]').first().innerText();
    assert.ok(NEW_HEADING_ROW.test(picked), `the new heading is selected, selection is ${picked}`);
    await undo();
    assert.deepEqual(changedFiles(), [], 'undo removes it');
  });

  await check('wrap puts the element in a container and selects it, unwrap gives it back, each is one undo', async () => {
    const direct = await paragraphs();
    await frame.locator('main > p').first().click();
    await page.waitForTimeout(800);
    await page.keyboard.press('ControlOrMeta+g');
    await page.waitForTimeout(SETTLE_MS);
    assert.equal(await frame.locator('main > div > p').count(), 1, 'the paragraph is inside a new container');
    const picked = await page.locator('[data-testid="layers"] [data-layer][aria-selected="true"]').first().innerText();
    assert.ok(NEW_CONTAINER_ROW.test(picked), `the new container is selected, selection is ${picked}`);
    await page.keyboard.press('ControlOrMeta+Shift+g');
    await page.waitForTimeout(SETTLE_MS);
    assert.equal(await frame.locator('main > div > p').count(), 0, 'the container is gone from the page');
    assert.equal(await paragraphs(), direct, 'the paragraph is back under main');
    if (TAILWIND) {
      assert.deepEqual(changedFiles(), [], 'unwrap restores the source');
    }
    await undo();
    assert.equal(await frame.locator('main > div > p').count(), 1, 'one undo brings the container back');
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

  await check('position box: the bars start from what the source authors and turning one off removes it in one undo', async () => {
    const badge = frame.locator('#badge');
    await badge.click();
    const section = page.locator('[data-section="Position"]');
    await section.waitFor({ timeout: 10_000 });
    if ((await section.locator('[data-row="position"]').count()) === 0) {
      await section.locator('button.title').click();
    }
    const bar = (side) => section.locator(`[data-bar="${side}"]`);
    await bar('top').waitFor({ timeout: 10_000 });
    await page.waitForTimeout(800);
    const states = await Promise.all(['top', 'right', 'bottom', 'left'].map((side) => bar(side).getAttribute('aria-checked')));
    assert.deepEqual(states, ['true', 'true', 'false', 'false'], 'top and right are on, the others off');
    await bar('top').click();
    await page.waitForTimeout(SETTLE_MS);
    const removed = diffText().split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---'));
    assert.ok(removed.some((l) => (TAILWIND ? /top-3/ : /top:\s*12px/).test(l)), `top is removed from the source:\n${diffText()}`);
    assert.ok(!diffText().split('\n').some((l) => l.startsWith('+') && /top:|top-3/.test(l)), 'nothing re-adds it');
    assert.notEqual(await badge.evaluate((e) => getComputedStyle(e).top), '12px', 'the page shows the offset gone');
    await undo();
    assert.deepEqual(changedFiles(), [], 'one undo restores the source');
  });

  await check('link: the address and the new-tab toggle write the source and each undo restores it', async () => {
    await frame.locator('a').first().click();
    const address = page.locator('[data-field="link-href"]');
    await address.waitFor({ timeout: 10_000 });
    await address.fill('/pricing');
    await address.press('Enter');
    await page.waitForTimeout(SETTLE_MS);
    assert.ok(diffText().includes('href="/pricing"') || diffText().includes("href='/pricing'"), `href written:\n${diffText()}`);
    assert.equal(await frame.locator('a').first().getAttribute('href'), '/pricing', 'the page shows the new address');
    await page.locator('[data-field="link-new-tab"]').check();
    await page.waitForTimeout(SETTLE_MS);
    assert.ok(/target="_blank"/.test(diffText()) && /rel="noopener noreferrer"/.test(diffText()), `target and rel written:\n${diffText()}`);
    await undo();
    assert.ok(!/target="_blank"/.test(diffText()) && /\/pricing/.test(diffText()), 'one undo removes only the new-tab change');
    await undo();
    assert.deepEqual(changedFiles(), [], 'a second undo restores the source');
  });

  await check('events: a go-to-page action adds one handler, the list shows it and opens its line, undo restores', async () => {
    const button = frame.locator('#cta');
    await button.click();
    const target = page.locator('[data-field="go-target"]');
    await target.waitFor({ timeout: 10_000 });
    assert.equal(await page.locator('[data-section="Events"] [data-event]').count(), 0, 'no handler listed before');
    await target.fill('/pricing');
    await page.locator('[data-field="go-add"]').click();
    await page.waitForTimeout(SETTLE_MS);
    assert.ok(GO_PAGE_CODE.test(diffText()), `the handler is written:\n${diffText()}`);
    const [file] = changedFiles();
    const line = readFileSync(join(APP, file), 'utf8').split('\n').findIndex((l) => HANDLER_ATTRIBUTE.test(l)) + 1;
    if (NEXT) {
      assert.ok(readFileSync(join(APP, file), 'utf8').startsWith("'use client'"), 'the file became a client component');
    } else {
      await button.click();
      const row = page.locator('[data-section="Events"] [data-event="click"]');
      await row.waitFor({ timeout: 10_000 });
      assert.ok((await row.innerText()).includes('inline'), 'the handler is listed as inline');
      printed.length = 0;
      await row.click();
      const opened = new RegExp(`:${line}:\\d+`);
      for (let waited = 0; waited < OPEN_WAIT_MS && !opened.test(printed.join('')); waited += OPEN_POLL_MS) {
        await page.waitForTimeout(OPEN_POLL_MS);
      }
      assert.ok(opened.test(printed.join('')), `the editor opens line ${line}; printed: ${printed.join('').slice(-300)}`);
    }
    await undo();
    assert.deepEqual(changedFiles(), [], 'one undo removes the handler and the import');
  });

  const LINKS = [['#start', 'Start free'], ['#docs', 'Read docs'], ['#features', 'Features']];

  for (const [href, label] of LINKS) {
    await check(`clicking the link "${label}" selects the link, not its container`, async () => {
      await frame.locator('h1').first().click();
      await frame.locator(`a[href="${href}"]`).first().click();
      await page.waitForTimeout(800);
      const crumbs = (await page.getByTestId('breadcrumb').first().innerText()).trim();
      assert.ok(LINK_CRUMB.test(crumbs.split('›').pop().trim()), `breadcrumb ends with the link: ${crumbs}`);
    });

    await check(`double-clicking the link "${label}" edits only that link's text`, async () => {
      const link = frame.locator(`a[href="${href}"]`).first();
      await frame.locator('h1').first().click();
      await link.click();
      await page.waitForTimeout(800);
      await opened(link);
      const editable = await frame.locator('[contenteditable]').evaluateAll((els) => els.map((el) => el.textContent.trim()));
      assert.deepEqual(editable, [label], 'only the link is editable');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(SETTLE_MS);
      await undoAll();
    });
  }

  await check('loop items: dragging one onto another reorders the array and the page, and one undo restores it', async () => {
    const items = frame.locator('#topics > li');
    const names = () => items.allInnerTexts();
    assert.deepEqual(await names(), TOPICS);
    await items.nth(2).click();
    await page.waitForTimeout(800);
    const from = await items.nth(2).boundingBox();
    const to = await items.nth(0).boundingBox();
    await page.mouse.move(from.x + 10, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + 10, to.y + 2, { steps: 12 });
    await page.waitForTimeout(500);
    await page.mouse.up();
    await page.waitForTimeout(SETTLE_MS);
    assert.deepEqual(await names(), ['Assets', 'Briefs', 'Timelines'], 'the page shows the new order');
    assert.ok(/'Assets', 'Briefs', 'Timelines'/.test(diffText()), `the array order is written:\n${diffText()}`);
    await undo();
    assert.deepEqual(changedFiles(), [], 'undo restores the array');
  });

  if (LOOP_DATA) {
    const chips = frame.locator('#site-links > a');
    const labels = () => chips.allInnerTexts();
    const hrefs = () => chips.evaluateAll((els) => els.map((el) => el.getAttribute('href')));
    const reveal = () => chips.first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
    const selected = async (index) => {
      await reveal();
      await chips.nth(index).click();
      await page.waitForTimeout(800);
    };
    const onlyLinksFile = () => {
      const files = changedFiles();
      assert.equal(files.length, 1, `one file changed: ${files}`);
      assert.ok(LINKS_FILE.test(files[0]), `the data file changed, not the page: ${files}`);
    };

    await check('loop data: dragging a chip reorders the imported array and one undo restores it', async () => {
      assert.deepEqual(await labels(), SITE_LINKS);
      await selected(3);
      const from = await chips.nth(3).boundingBox();
      const to = await chips.nth(0).boundingBox();
      await page.mouse.move(from.x + 8, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(to.x + 3, to.y + to.height / 2, { steps: DRAG_STEPS });
      await page.waitForTimeout(500);
      await page.mouse.up();
      await page.waitForTimeout(SETTLE_MS);
      assert.deepEqual(await labels(), ['Pricing', 'Download', 'Documentation', 'Community'], 'the page shows the new order');
      onlyLinksFile();
      await undo();
      assert.deepEqual(changedFiles(), [], 'undo restores the data');
      assert.deepEqual(await labels(), SITE_LINKS, 'undo restores the page');
    });

    await check('loop data: duplicate copies the entry right after itself and one undo restores it', async () => {
      await selected(1);
      await page.keyboard.press('ControlOrMeta+d');
      await page.waitForTimeout(SETTLE_MS);
      assert.deepEqual(await labels(), ['Download', 'Documentation', 'Documentation', 'Community', 'Pricing'], 'the page shows the copy');
      onlyLinksFile();
      assert.equal(diffText().split('\n').filter((line) => line.startsWith('+') && line.includes("label: 'Documentation'")).length, 1, `the entry was added once:\n${diffText()}`);
      await undo();
      assert.deepEqual(changedFiles(), [], 'undo restores the data');
      assert.deepEqual(await labels(), SITE_LINKS);
    });

    await check('loop data: the context menu deletes the entry and one undo restores it', async () => {
      await reveal();
      await chips.nth(0).click({ button: 'right' });
      await page.getByTestId('structure-menu').getByRole('menuitem', { name: /Delete/ }).click();
      await page.waitForTimeout(SETTLE_MS);
      assert.deepEqual(await labels(), SITE_LINKS.slice(1), 'the entry left the page');
      onlyLinksFile();
      await undo();
      assert.deepEqual(changedFiles(), [], 'undo restores the data');
      assert.deepEqual(await labels(), SITE_LINKS);
    });

    await check('loop data: Add item appends a copy of the selected entry and one undo restores it', async () => {
      await selected(2);
      await page.getByTestId('add-button').click();
      await page.getByTestId('add-menu').getByRole('menuitem', { name: 'Add item' }).click();
      await page.waitForTimeout(SETTLE_MS);
      assert.deepEqual(await labels(), [...SITE_LINKS, 'Community'], 'the page shows the new item at the end');
      onlyLinksFile();
      await undo();
      assert.deepEqual(changedFiles(), [], 'undo restores the data');
      assert.deepEqual(await labels(), SITE_LINKS);
    });

    await check('loop data: editing the text of a chip writes its label and one undo restores it', async () => {
      await selected(0);
      await opened(chips.nth(0));
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.type('Get the app');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(SETTLE_MS);
      assert.deepEqual(await labels(), ['Get the app', ...SITE_LINKS.slice(1)], 'the page shows the new label');
      onlyLinksFile();
      assert.ok(/label: 'Get the app'/.test(diffText()), `the label literal is written:\n${diffText()}`);
      assert.ok(!/label: 'Download'/.test(readFileSync(join(APP, changedFiles()[0]), 'utf8')), 'only that entry changed');
      await undo();
      assert.deepEqual(changedFiles(), [], 'undo restores the data');
      assert.deepEqual(await labels(), SITE_LINKS);
    });

    await check('loop data: editing the address of a chip writes its href and one undo restores it', async () => {
      await selected(0);
      const address = page.locator('[data-field="link-href"]');
      await address.waitFor({ timeout: 10_000 });
      await address.fill('/get-the-app');
      await address.press('Enter');
      await page.waitForTimeout(SETTLE_MS);
      onlyLinksFile();
      assert.ok(/href: '\/get-the-app'/.test(diffText()), `the href literal is written:\n${diffText()}`);
      assert.equal((await hrefs())[0], '/get-the-app', 'the page shows the new address');
      await undo();
      assert.deepEqual(changedFiles(), [], 'undo restores the data');
    });

    await check('loop data: an address that is a constant is refused with its name and the source is untouched', async () => {
      await selected(1);
      await page.locator('[data-testid="link-refused"]').waitFor({ timeout: 10_000 });
      assert.match(await page.locator('[data-testid="link-refused"]').innerText(), /DOCS_URL/);
      assert.equal(await page.locator('[data-field="link-href"]').isDisabled(), true);
      assert.deepEqual(changedFiles(), []);
    });
  }

  await check('two components in a page: dragging one layer past the other reorders their usages and one undo restores it', async () => {
    await frame.locator('#benefits').click();
    await page.waitForTimeout(800);
    const layers = page.locator('[data-testid="layers"] [data-layer]');
    const benefits = layers.filter({ hasText: /^\s*Benefits/ }).first();
    const faq = layers.filter({ hasText: /^\s*Faq/ }).first();
    await benefits.dragTo(faq, { targetPosition: { x: 60, y: 20 } });
    await page.waitForTimeout(SETTLE_MS);
    const order = await frame.locator('main').first().evaluate((main) => [...main.children].map((c) => c.id).filter((id) => id === 'faq' || id === 'benefits'));
    assert.deepEqual(order, ['faq', 'benefits'], 'the page shows the new order');
    await undo();
    assert.deepEqual(changedFiles(), [], 'undo restores the usages');
  });

  await check('an icon from a library is picked as one element, swapped in its usage, and one undo restores it', async () => {
    const arrow = frame.locator('svg.lucide-arrow-right');
    if (!HAS_ICON) {
      return;
    }
    await arrow.first().waitFor({ timeout: 10_000 });
    await arrow.locator('path').first().click({ force: true });
    await page.waitForTimeout(800);
    const picked = page.locator('[data-testid="layers"] [data-layer][aria-selected="true"]');
    assert.equal(await picked.count(), 1, 'the icon has its own layer row');
    assert.ok((await picked.first().innerText()).includes('ArrowRight'), 'the layer is named after the component');
    await page.locator('[data-field="icon-replace"]').click();
    await page.locator('.icon-tile').first().waitFor({ timeout: 10_000 });
    assert.equal(await page.locator('.icon-tile').first().getAttribute('title'), 'arrow-right', 'the current icon is offered first');
    await page.locator('.icon-tile[title="heart"]').click();
    await page.waitForTimeout(SETTLE_MS);
    assert.ok(/<Heart\b/.test(diffText()) && /\bHeart\b[^\n]*from/.test(diffText()), `the usage and import are rewritten:\n${diffText()}`);
    assert.ok(!/^\+.*ArrowRight/m.test(diffText()), 'the old name is gone');
    await frame.locator('svg.lucide-heart').waitFor({ timeout: 10_000 });
    await undo();
    assert.deepEqual(changedFiles(), [], 'one undo restores the source');
  });

  if (NEXT) {
    await check('a use client page renders, hydrates and lists its layers', async () => {
      const address = page.getByTestId('address');
      await address.fill('/client');
      await address.press('Enter');
      await frame.locator('#client-title').waitFor({ timeout: CLIENT_PAGE_MS });
      await page.getByRole('radio', { name: 'Navigate' }).click();
      await frame.locator('#count').click();
      await frame.getByText('Clicked 1').waitFor({ timeout: CLIENT_PAGE_MS });
      await page.getByRole('radio', { name: 'Design' }).click();
      await frame.locator('#client-title').click();
      await page.waitForTimeout(800);
      const picked = await page.locator('[data-testid="layers"] [data-layer][aria-selected="true"]').count();
      assert.equal(picked, 1, 'the client page elements are selectable');
      await address.fill('/');
      await address.press('Enter');
      await frame.locator('h1').first().waitFor({ timeout: CLIENT_PAGE_MS });
    });
  }

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
