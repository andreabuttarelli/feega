import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { openPanel } from './harness.mts';
import { ServerState, ToView } from '../src/messages.ts';

const APP_ROOT = process.env.INSPECT_APP_ROOT!;
const TEXT = process.env.INSPECT_TEXT ?? '.lead';
const BOX = process.env.INSPECT_BOX ?? '#hero';
const SHOTS = join(homedir(), 'Documents/feega-videos/shots/inspect');
const SETTLE_MS = 2500;

await mkdir(SHOTS, { recursive: true });
const panel = await openPanel(APP_ROOT);
const { page } = panel;
const shot = (name: string) => page.screenshot({ path: join(SHOTS, `${name}.png`) });

const text = await panel.pickAt(TEXT);
await shot('01-select-text');

await panel.reply({ kind: ToView.Change, row: 'font-weight', value: '700' });
const weight = await page.waitForFunction(() => true).then(() => panel.frame.locator(TEXT).first().evaluate((el) => getComputedStyle(el).fontWeight));
console.log('font-weight right after the edit:', weight);
await panel.reply({ kind: ToView.Change, row: 'color', value: '#0078d4' });
await page.waitForTimeout(SETTLE_MS);
await shot('02-edit-saved');

await page.locator('[data-testid=app-frame]').evaluate((f: HTMLIFrameElement) => (f.src = f.src));
await page.waitForTimeout(SETTLE_MS);
const after = await panel.frame.locator(TEXT).first().evaluate((el) => [getComputedStyle(el).fontWeight, getComputedStyle(el).color]);
console.log('after reload:', after, 'source:', text?.source);
await shot('03-after-reload');

await panel.pickAt(BOX);
const typography = await page.locator('[data-section=Typography]').count();
console.log('container shows Typography:', typography > 0);
await shot('04-container-sections');

await page.keyboard.press('n');
await page.waitForTimeout(400);
await shot('05-mode-navigate');
await page.keyboard.press('d');
await page.waitForTimeout(400);
await shot('06-mode-design');

for (const state of Object.values(ServerState)) {
  await panel.reply({ kind: ToView.Server, state, reason: state === ServerState.Stopped ? 'the dev server exited' : undefined });
  await page.locator('[data-testid=server-dot]').hover();
  await page.waitForTimeout(200);
  await page.locator('.toolbar').screenshot({ path: join(SHOTS, `07-server-${state}.png`) });
}
await panel.reply({ kind: ToView.Server, state: ServerState.Running });

for (const key of ['3', '4', '1']) {
  await page.mouse.move(5, 5);
  await page.keyboard.press(key);
  await page.waitForTimeout(500);
  await shot(`08-size-${key === '3' ? 'tablet' : key === '4' ? 'phone' : 'full'}`);
}

await page.keyboard.press('Meta+\\');
await page.waitForTimeout(400);
await shot('09-bar-collapsed');
await page.keyboard.press('Meta+\\');

await page.goto(`http://127.0.0.1:5999/light`);
await page.locator('.overlay').waitFor();
await panel.pickAt(TEXT);
await shot('10-light-design');
await page.keyboard.press('n');
await page.waitForTimeout(400);
await shot('11-light-navigate');

await panel.edits.undo();
await panel.edits.undo();
await panel.close();
