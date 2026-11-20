import { homedir } from 'node:os';
import { join } from 'node:path';
import { openPanel } from './harness.mts';

const SHOTS = join(homedir(), 'Documents/feega-videos/shots/inspect');
const panel = await openPanel(process.env.INSPECT_APP_ROOT!);
const { page } = panel;
const base = `http://127.0.0.1:${process.env.PANEL_PORT ?? 5999}`;

for (const theme of ['dark', 'light']) {
  if (theme === 'light') {
    await page.goto(`${base}/light`);
    await page.locator('.overlay').waitFor({ timeout: 120_000 });
  }
  await panel.pickAt(process.env.INSPECT_TEXT ?? '.lead');
  await page.waitForTimeout(800);
  await page.locator('[data-field=color] .swatch-trigger').click();
  await page.locator('[data-testid=colour-picker]').waitFor();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(SHOTS, `21-colour-picker-${theme}.png`), clip: { x: 900, y: 0, width: 540, height: 760 } });
  await page.keyboard.press('Escape');
  await page.locator('[data-field=font-family] , .font-field').first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(SHOTS, `22-font-picker-${theme}.png`), clip: { x: 900, y: 0, width: 540, height: 760 } });
  await page.keyboard.press('Escape');
}
await panel.close();
process.exit(0);
