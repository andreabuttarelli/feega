import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { DARK, LIGHT, openPanel } from './harness.mts';

const APP_ROOT = process.argv[2];
const SHOTS = join(homedir(), 'Documents/feega-videos/shots/inspect');
const SETTLE_MS = 2500;

await mkdir(SHOTS, { recursive: true });
for (const [name, theme] of [['dark', DARK], ['light', LIGHT]] as const) {
  const panel = await openPanel(APP_ROOT, theme);
  const { page } = panel;
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('radio', { name: 'Tablet' }).click();
  await page.waitForTimeout(SETTLE_MS);
  await page.screenshot({ path: join(SHOTS, `device-bar-${name}.png`) });
  await page.locator('.handle.right').hover();
  await page.screenshot({ path: join(SHOTS, `device-bar-${name}-handle.png`), clip: { x: 0, y: 0, width: 1280, height: 120 } });
  await panel.close();
}
process.exit(0);
