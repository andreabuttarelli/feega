import { homedir } from 'node:os';
import { join } from 'node:path';
import { openPanel } from './harness.mts';

const SHOTS = join(homedir(), 'Documents/feega-videos/shots/inspect');
const panel = await openPanel(process.env.INSPECT_APP_ROOT!);
const { page } = panel;

for (const theme of ['dark', 'light']) {
  if (theme === 'light') {
    await page.goto('http://127.0.0.1:5999/light');
    await page.locator('.overlay').waitFor();
  }
  await page.locator('[data-testid=feega-menu]').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(SHOTS, `12-menu-${theme}.png`), clip: { x: 0, y: 0, width: 520, height: 640 } });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  console.log(theme, 'closed by Esc:', (await page.locator('[role=dialog]').count()) === 0);
}
await panel.close();
