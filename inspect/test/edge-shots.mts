import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { openPanel } from './harness.mts';

const SHOTS = process.env.SHOTS!;
mkdirSync(SHOTS, { recursive: true });

const panel = await openPanel(process.env.INSPECT_APP_ROOT!);
const { page } = panel;

await page.locator('[data-testid="pages-tab"]').click();
await page.locator('[data-testid="page-not-found"]').first().waitFor();
await page.screenshot({ path: join(SHOTS, '1-pages.png') });
console.log('not found rows', await page.locator('[data-testid="page-not-found"]').count());

const inFocus = panel.frame.frameLocator('#feega-focus');
await panel.pickAt(process.env.PICK ?? 'a');
await page.waitForTimeout(500);
await page.keyboard.press('f');
await page.waitForTimeout(4000);

await page.waitForTimeout(600);
await page.locator('[data-testid="components-tab"]').click();
await page.locator('[data-testid="component-folder"]').first().waitFor();
await page.locator('[data-testid="components"] [aria-expanded="false"]').evaluateAll((f) => f.forEach((x) => (x as HTMLElement).click()));
await page.waitForTimeout(500);
const expanders = page.locator('[data-testid="component-expand"]');
const total = await expanders.count();
console.log('expanders', total);
for (let i = 0; i < total; i++) {
  await expanders.nth(i).click();
  await page.waitForTimeout(300);
  if ((await page.locator('[data-testid="component-preset"]').count()) > 0) {
    break;
  }
}
console.log('presets', await page.locator('[data-testid="component-preset"]').count());
await page.locator('[data-testid="component-preset"]').first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
await page.locator('[data-testid="component-preset"]').first().click();
await page.waitForTimeout(500);
await page.locator('[data-testid="component-preset"]').first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
await page.screenshot({ path: join(SHOTS, '2-components.png') });
await panel.close();
