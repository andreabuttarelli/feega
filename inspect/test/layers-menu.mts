import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { openPanel } from './harness.mts';

const APP = process.env.INSPECT_APP_ROOT!;
const REPO = join(APP, '..');
const SHOTS = process.env.SHOTS!;
mkdirSync(SHOTS, { recursive: true });

const panel = await openPanel(APP);
const { page } = panel;
const diff = () => execFileSync('git', ['diff', '--no-color', '-U1', '--', 'landing/src'], { cwd: REPO, encoding: 'utf8' });
const reset = () => execFileSync('git', ['checkout', '--', 'landing/src'], { cwd: REPO });
const shot = (name: string) => page.screenshot({ path: join(SHOTS, `${name}.png`) });
const log = (...a: unknown[]) => console.log(...a);

const TARGET = 'src/routes/+layout.svelte:47:1';

async function reveal(id: string) {
  const row = page.locator(`[data-layer="${id}"]`);
  for (let i = 0; i < 12 && !(await row.count()); i++) {
    const twists = page.locator('[aria-label=Expand]');
    if (!(await twists.count())) {
      break;
    }
    await twists.first().click();
    await page.waitForTimeout(150);
  }
  if (!(await row.count())) {
    log('layers:', await page.locator('[data-layer]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.layer)));
    await shot('debug-layers');
  }
  await row.waitFor({ timeout: 15_000 });
  return row;
}

async function settle(ms = 2500) {
  await page.waitForTimeout(ms);
}

async function rowCount(id: string) {
  return page.locator(`[data-layer="${id}"]`).count();
}

await settle(4000);
const row = await reveal(TARGET);
log('target row found');
await row.click({ position: { x: 60, y: 10 } });
await settle(500);
await shot('00-layers-selected');

await row.click({ button: 'right', position: { x: 60, y: 10 } });
await page.locator('[data-testid=structure-menu]').waitFor();
log('menu items', await page.locator('[data-testid=structure-menu] [role=menuitem]').allInnerTexts());
log('selected before menu:', await row.getAttribute('aria-selected'));
await shot('01-menu-open');

await page.locator('[data-testid=structure-menu] [data-op=add-child]').hover();
await page.locator('[data-testid=structure-submenu]').waitFor();
log('add submenu', await page.locator('[data-testid=structure-submenu] [role=menuitem]').allInnerTexts());
await shot('02-add-as-child-submenu');

await page.locator('[data-testid=structure-menu] [data-op=wrap-with]').hover();
await page.waitForTimeout(200);
log('wrap submenu', await page.locator('[data-testid=structure-submenu] [role=menuitem]').allInnerTexts());
await shot('03-wrap-with-submenu');

await page.keyboard.press('Escape');
await page.waitForTimeout(200);
log('closed by Esc:', (await page.locator('[data-testid=structure-menu]').count()) === 0);

await row.click({ button: 'right', position: { x: 60, y: 10 } });
await page.locator('[data-testid=structure-menu]').waitFor();
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
log('focused after 3 arrows (Copy->Duplicate->Add as child expected at 2 downs from first):', await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.op));
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(150);
log('sub focus:', await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.op));
await shot('04-keyboard-submenu');
await page.keyboard.press('ArrowLeft');
log('back to:', await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.op));
await page.keyboard.press('Escape');

const before = await page.locator('[data-layer]').count();
await row.click({ button: 'right', position: { x: 60, y: 10 } });
await page.locator('[data-testid=structure-menu] [data-op=add-child]').click();
await page.locator('[data-testid=structure-submenu] [data-op="add-child:text"]').click();
await settle();
log('--- diff after Add as child > Text\n' + diff());
await shot('05-after-add-child');
log('layer rows before/after:', before, await page.locator('[data-layer]').count());

await page.keyboard.press('Meta+z');
await settle();
log('--- diff after undo (empty expected):', JSON.stringify(diff()));

await (await reveal(TARGET)).click({ button: 'right', position: { x: 60, y: 10 } });
await page.locator('[data-testid=structure-menu] [data-op=wrap-with]').click();
await page.locator('[data-testid=structure-submenu] [data-op="wrap:section"]').click();
await settle();
log('--- diff after Wrap with section\n' + diff());
await shot('06-after-wrap');
await page.keyboard.press('Meta+z');
await settle();
log('--- diff after undo (empty expected):', JSON.stringify(diff()));
reset();
await settle(1500);

await (await reveal(TARGET)).click({ position: { x: 60, y: 10 } });
await page.locator('[data-testid=add-button]').click();
const item = page.locator('[data-testid=add-menu] [data-op=heading]');
const layerRow = await reveal(TARGET);
const box = (await layerRow.boundingBox())!;
const itemBox = (await item.boundingBox())!;
await page.mouse.move(itemBox.x + 20, itemBox.y + 10);
await page.mouse.down();
await page.mouse.move(box.x + 60, box.y + box.height / 2, { steps: 12 });
await page.waitForTimeout(300);
await shot('07-drag-into-layers-child');
await page.mouse.move(box.x + 60, box.y + 2, { steps: 4 });
await page.waitForTimeout(300);
await shot('08-drag-into-layers-before');
await page.mouse.move(box.x + 60, box.y + box.height / 2, { steps: 4 });
await page.mouse.up();
await settle();
log('--- diff after drag into Layers (middle = last child)\n' + diff());
await page.keyboard.press('Meta+z');
await settle();
log('--- diff after undo (empty expected):', JSON.stringify(diff()));
reset();
await settle(1500);

await (await reveal(TARGET)).click({ position: { x: 60, y: 10 } });
await page.locator('[data-testid=add-button]').click();
const item2 = page.locator('[data-testid=add-menu] [data-op=button]');
const itemBox2 = (await item2.boundingBox())!;
const overlay = (await page.locator('.overlay').boundingBox())!;
await page.mouse.move(itemBox2.x + 20, itemBox2.y + 10);
await page.mouse.down();
await page.mouse.move(overlay.x + overlay.width / 2, overlay.y + overlay.height / 2, { steps: 15 });
await page.waitForTimeout(800);
await shot('09-drag-into-preview');
await page.mouse.move(overlay.x + overlay.width / 2 + 40, overlay.y + overlay.height / 2 + 30, { steps: 6 });
await page.waitForTimeout(800);
log('outline/line visible:', await page.locator('[data-testid=add-outline]').count(), await page.locator('[data-testid=add-line]').count());
await shot('10-drag-into-preview-b');
await page.mouse.up();
await settle();
log('--- diff after drag into preview\n' + diff());
await page.keyboard.press('Meta+z');
await settle();
log('--- diff after undo (empty expected):', JSON.stringify(diff()));
reset();

await panel.close();
process.exit(0);
