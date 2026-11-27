import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { ToView } from '../src/messages.ts';
import { openPanel } from './harness.mts';

const SHOT = process.env.SHOT!;
mkdirSync(dirname(SHOT), { recursive: true });

const panel = await openPanel(process.env.INSPECT_APP_ROOT!);
const { page, reply } = panel;

await page.locator('[data-testid="components-tab"]').click();
await page.locator('[data-testid="component-row"]').first().waitFor();
const first = await page.locator('[data-testid="component-row"]').evaluateAll((rows) => rows.map((r) => (r as HTMLElement).dataset.name!));

const rows = first.map((name) => ({ name, file: `src/lib/${name}.svelte`, folder: 'lib', uses: 0 }));
await reply({ kind: ToView.Components, components: [...rows, { name: 'Brand New', file: 'src/lib/BrandNew.svelte', folder: 'lib', uses: 0 }] });
await page.locator('[data-testid="component-row"][data-name="Brand New"].fresh').waitFor();
await page.screenshot({ path: SHOT });

await page.locator('[data-testid="canvas-open-components"]').click();
await page.locator('[data-testid="components-canvas"]').waitFor();
await page.waitForTimeout(3000);
await page.locator('[data-testid="components-canvas"]').hover();
await page.keyboard.down('Control');
await page.mouse.wheel(0, -300);
await page.keyboard.up('Control');
await page.waitForTimeout(300);
const zoomed = await page.locator('[data-testid="canvas-percent"]').textContent();

await reply({ kind: ToView.Components, components: rows.slice(1) });
await page.waitForTimeout(500);
assert.equal(await page.locator('[data-testid="canvas-percent"]').textContent(), zoomed, 'zoom survives a list change');
assert.equal(await page.locator('[data-testid="canvas-frame"]').count(), rows.length - 1, 'removed component leaves the canvas');

await panel.close();
