import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { openPanel } from './harness.mts';

const APP = process.env.INSPECT_APP_ROOT!;
const REPO = join(APP, '..');
const SHOTS = process.env.SHOTS!;
mkdirSync(SHOTS, { recursive: true });

const panel = await openPanel(APP);
const { page, frame } = panel;

const diff = () => execFileSync('git', ['diff', '--no-color', '-U1', '--', 'landing/src'], { cwd: REPO, encoding: 'utf8' });
const reset = () => execFileSync('git', ['checkout', '--', 'landing/src'], { cwd: REPO });
const shot = (name: string) => page.screenshot({ path: join(SHOTS, `${name}.png`) });
const log = (...a: unknown[]) => console.log(...a);
const settle = (ms = 2500) => page.waitForTimeout(ms);

const MODES = 'src/lib/site/home/Modes.svelte';
const HERO = 'src/lib/site/home/Hero.svelte';
const rowOf = (id: string) => page.locator(`[data-layer="${id}"]`).first();
const selectedRows = () => page.locator('[data-layer][aria-selected=true]').evaluateAll((els) => [...new Set(els.map((e) => (e as HTMLElement).dataset.layer))]);
const outlines = () => page.locator('[data-testid=selected-outline]').count();
const panelHeader = async () => ((await page.locator('[data-testid=multi-selection] strong').count()) ? page.locator('[data-testid=multi-selection] strong').innerText() : '(single panel)');
const status = async () => ((await page.locator('[data-testid=status]').count()) ? page.locator('[data-testid=status]').innerText() : '');

async function expandAll() {
  for (let round = 0; round < 6; round++) {
    const twists = page.locator('[aria-label=Expand]');
    for (let i = (await twists.count()) - 1; i >= 0; i--) {
      await twists.nth(i).click().catch(() => undefined);
    }
    await page.waitForTimeout(250);
  }
}

const click = (id: string, modifiers: ('Shift' | 'Meta')[] = [], button: 'left' | 'right' = 'left') => rowOf(id).scrollIntoViewIfNeeded().then(() => rowOf(id).click({ position: { x: 60, y: 10 }, modifiers, button }));

async function check(label: string, ok: boolean, detail?: unknown) {
  log(ok ? 'PASS' : 'FAIL', label, detail === undefined ? '' : JSON.stringify(detail));
}

await settle(4000);
await expandAll();
await rowOf(`${MODES}:12:5`).locator('.twist').click();
await page.waitForTimeout(300);

await click(`${MODES}:12:5`);
await page.waitForTimeout(300);
await click(`${MODES}:17:5`, ['Shift']);
await page.waitForTimeout(500);
const range = await selectedRows();
await check('shift-click selects the visible rows between anchor and click', range.length === 3, range);
await check('panel says N elements', (await panelHeader()) === '3 elements selected', await panelHeader());
await check('preview outlines the non-primary elements', (await outlines()) === 2, await outlines());
await shot('01-range-in-layers');

await click(`${MODES}:16:5`, ['Meta']);
await page.waitForTimeout(400);
const toggledOff = await selectedRows();
await check('cmd-click removes a selected row', toggledOff.length === 2 && !toggledOff.includes(`${MODES}:16:5`), toggledOff);
await click(`${MODES}:16:5`, ['Meta']);
await page.waitForTimeout(400);
const toggledOn = await selectedRows();
await check('cmd-click adds it back and it becomes primary', toggledOn.length === 3, toggledOn);
await shot('02-toggle');

await click(`${MODES}:12:5`);
await page.waitForTimeout(400);
await check('plain click goes back to a single selection', (await selectedRows()).length === 1 && (await panelHeader()) === '(single panel)');

await rowOf(`${MODES}:12:5`).locator('.twist').click();
await page.waitForTimeout(300);
await click(`${MODES}:13:7`);
await page.waitForTimeout(400);
const price = await frame.locator('.mode .price').first().boundingBox();
const shiftClick = async (x: number, y: number) => {
  await page.keyboard.down('Shift');
  await page.mouse.click(x, y);
  await page.keyboard.up('Shift');
};
await shiftClick(price!.x + 4, price!.y + 4);
await page.waitForTimeout(800);
const previewRows = await selectedRows();
await check('shift-click in the preview adds an element', previewRows.length === 2, previewRows);
await check('every selected element is outlined in the preview, the primary has the label', (await outlines()) === 1 && (await page.locator('.outline.picked .label').count()) === 1);
await shot('03-preview-shift-click');
await shiftClick(price!.x + 4, price!.y + 4);
await page.waitForTimeout(800);
await check('shift-click again removes it', (await selectedRows()).length === 1, await selectedRows());

reset();
await click(`${MODES}:16:5`);
await click(`${MODES}:19:7`, ['Meta']);
await click(`${HERO}:21:3`, ['Meta']);
await page.waitForTimeout(500);
await check('three rows of two files selected', (await selectedRows()).length === 3, await selectedRows());
await page.keyboard.press('Delete');
await settle();
const deleted = diff();
log('--- diff after Delete x3\n' + deleted);
await check('delete removed three elements in two files', (deleted.match(/^diff --git/gm)?.length ?? 0) === 2 && (deleted.match(/^-\s*</gm)?.length ?? 0) >= 3);
await shot('04-after-delete-3');
await page.keyboard.press('Meta+z');
await settle();
await check('one undo restores all three', diff() === '', diff());

await click(`${MODES}:13:7`);
await click(`${MODES}:14:7`, ['Meta']);
await page.keyboard.press('Meta+d');
await settle();
const duplicated = diff();
log('--- diff after duplicate x2\n' + duplicated);
await check('duplicate added two copies', (duplicated.match(/^\+\s*<span/gm)?.length ?? 0) === 2);
await shot('05-after-duplicate-2');
await page.keyboard.press('Meta+z');
await settle();
await check('undo restores', diff() === '', diff());

await click(`${MODES}:13:7`);
await click(`${MODES}:14:7`, ['Meta']);
await page.keyboard.press('Meta+g');
await settle();
const wrapped = diff();
log('--- diff after wrap with Cmd+G\n' + wrapped);
await check('wrap put both siblings in one div', /\+\s*<div[^>]*>/.test(wrapped) && (wrapped.match(/^\+\s*<div/gm)?.length ?? 0) === 1 && /\+\s*<\/div>/.test(wrapped));
await shot('06-after-wrap-2');
await page.keyboard.press('Meta+z');
await settle();
await check('undo restores', diff() === '', diff());

await click(`${MODES}:12:5`);
await click(`${MODES}:17:5`, ['Meta']);
await page.keyboard.press('Meta+g');
await settle(1500);
await check('wrapping elements that are not adjacent is refused with a reason', diff() === '' && (await status()).includes('next to each other'), await status());
await shot('07-wrap-refused');

await settle(1500);
await click(`${MODES}:16:5`);
await page.waitForTimeout(500);
await page.keyboard.press('Tab');
await page.waitForTimeout(600);
await check('Tab selects the next sibling', JSON.stringify(await selectedRows()) === JSON.stringify([`${MODES}:17:5`]), await selectedRows());
await page.keyboard.press('Shift+Tab');
await page.waitForTimeout(600);
await check('Shift+Tab selects the previous sibling', JSON.stringify(await selectedRows()) === JSON.stringify([`${MODES}:16:5`]), await selectedRows());
await click(`${MODES}:12:5`);
await page.waitForTimeout(300);
await page.keyboard.press('Enter');
await page.waitForTimeout(600);
await check('Enter selects the first child', (await selectedRows()).join() === `${MODES}:13:7`, await selectedRows());
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
await check('Esc selects the parent', (await selectedRows()).join() === `${MODES}:12:5`, await selectedRows());
await page.keyboard.press('Meta+a');
await page.waitForTimeout(800);
const siblings = await selectedRows();
await check('Cmd+A selects the siblings of the primary', siblings.length === 3 && siblings.includes(`${MODES}:12:5`) && siblings.includes(`${MODES}:17:5`), siblings);
await shot('08-select-siblings');
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
await check('Esc clears the multi-selection and selects the parent', (await selectedRows()).join() === `${MODES}:11:3`, await selectedRows());

await click(`${MODES}:16:5`);
await click(`${MODES}:17:5`, ['Meta']);
await click(`${MODES}:16:5`, ['Meta'], 'right').catch(() => undefined);
await page.locator('[data-testid=structure-menu]').waitFor({ timeout: 3000 }).catch(() => undefined);
await check('right-click on a selected row keeps the selection and hides single-element items', (await selectedRows()).length === 2 && (await page.locator('[data-testid=structure-menu] [data-op=add-child]').count()) === 0, await page.locator('[data-testid=structure-menu] [role=menuitem]').allInnerTexts());
await shot('09-menu-on-selection');
await page.locator('[data-testid=structure-menu] [data-op=copy-for-agent]').click();
await page.waitForTimeout(400);
const clip = panel.copied.at(-1) ?? '';
log('clipboard:\n' + clip);
await check('copy for agent writes one block with both elements', clip.startsWith('Feega selection: 2 elements') && (clip.match(/source:/g)?.length ?? 0) === 2);

await click(`${MODES}:16:5`, [], 'right');
await page.locator('[data-testid=structure-menu]').waitFor({ timeout: 3000 });
await page.waitForTimeout(200);
await page.keyboard.press('Escape');
await click(`${MODES}:13:7`, [], 'right');
await page.waitForTimeout(500);
await check('right-click on a row outside the selection selects just it', (await selectedRows()).join() === `${MODES}:13:7`, await selectedRows());
await page.keyboard.press('Escape');

await page.locator('input[data-testid=address]').click();
await page.keyboard.press('Delete');
await check('Delete in a text field does not delete elements', diff() === '', diff());

reset();
await panel.close();
process.exit(0);
