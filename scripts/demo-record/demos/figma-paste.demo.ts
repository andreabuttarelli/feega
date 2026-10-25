import { readFileSync } from 'node:fs';
import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { openCanvas } from './seed';

const FIGMA_CLIP = readFileSync(new URL('../../../tests/fixtures/figma/clip-1.html', import.meta.url), 'utf8');

test('figma paste', async ({ page, session }) => {
  await installCursor(page);
  await openCanvas(page, session);
  await page.evaluate(async (body) => {
    await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([body], { type: 'text/html' }), 'text/plain': new Blob(['figma'], { type: 'text/plain' }) })]);
  }, FIGMA_CLIP);
  const pane = (await page.locator('.svelte-flow').boundingBox())!;

  await recordDemo(page, { slug: 'figma-paste', title: 'paste straight from figma' }, async (d) => {
    await d.click({ x: pane.x + pane.width * 0.85, y: pane.y + pane.height * 0.85 });
    await d.move({ x: pane.x + pane.width * 0.5, y: pane.y + pane.height * 0.62 });
    await d.key('ControlOrMeta+v', '⌘ V');
    await expect(page.locator('[data-testid="frame-overlays"] [data-frame]')).toHaveCount(1, { timeout: 30_000 });
    await d.wait(1500);
    await d.key('Shift+Digit1', '⇧ 1');
    await d.wait(2000);
    const frame = (await page.locator('[data-testid="frame-overlays"] [data-frame]').boundingBox())!;
    await d.click({ x: frame.x + frame.width * 0.3, y: frame.y + frame.height * 0.3 });
    await d.click({ x: frame.x + frame.width * 0.3, y: frame.y + frame.height * 0.3 });
    await d.wait(1800);
  });
});
