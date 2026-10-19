import { test, expect, type Page } from '@playwright/test';
import { Paint, type ShapeBox } from './fixtures/poster-shapes-paint';

const HOST_PAGE = '/changelog';
const PROBE = '/tests/e2e/fixtures/poster-shapes-probe.ts';
const VIEWPORT = 2200;
const MIN_SIDE_PX = 2;

async function probe(page: Page) {
  await page.setViewportSize({ width: VIEWPORT, height: VIEWPORT });
  await page.goto(HOST_PAGE);
  await page.evaluate((path) => import(path), PROBE);
}

async function shots(page: Page, id: string, paint: Paint): Promise<Map<string, Buffer>> {
  const boxes: ShapeBox[] = await page.evaluate(([poster, how]) => window.posterShapes.mount(poster, how), [id, paint] as const);
  const shown = new Map<string, Buffer>();
  for (const { part, ...box } of boxes.filter((b) => b.width >= MIN_SIDE_PX && b.height >= MIN_SIDE_PX)) {
    shown.set(part, await page.screenshot({ clip: box, animations: 'disabled' }));
  }
  return shown;
}

test('a new colour on any shape of any builtin poster changes its pixels', async ({ page }) => {
  test.setTimeout(600_000);
  await probe(page);
  const posters = await page.evaluate(() => window.posterShapes.posters());
  expect(posters.length).toBeGreaterThan(10);

  const unchanged: string[] = [];
  for (const id of posters) {
    const before = await shots(page, id, Paint.Template);
    const after = await shots(page, id, Paint.Recoloured);
    const hidden = await shots(page, id, Paint.Hidden);
    const visible = [...before].filter(([part, pixels]) => !hidden.get(part)?.equals(pixels));
    for (const [part, pixels] of visible) {
      if (after.get(part)?.equals(pixels) ?? true) {
        unchanged.push(`${id} ${part}`);
      }
    }
  }
  expect(unchanged).toEqual([]);
});
