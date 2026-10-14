import { expect, type Locator, type Page } from '@playwright/test';

export type Box = { x: number; y: number; width: number; height: number };

const TOLERANCE_PX = 2;

const playerFrame = (page: Page) => page.getByTestId('editor-stage').locator('iframe').first();

export async function inkOf(page: Page, text: string): Promise<Box> {
  const frame = (await playerFrame(page).boundingBox())!;
  const ink = await page
    .getByTestId('editor-stage')
    .frameLocator('iframe')
    .first()
    .getByText(text, { exact: true })
    .evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      return {
        x: r.left,
        y: r.top,
        width: r.width,
        height: r.height,
        viewport: innerWidth
      };
    });
  const scale = frame.width / ink.viewport;
  return {
    x: frame.x + ink.x * scale,
    y: frame.y + ink.y * scale,
    width: ink.width * scale,
    height: ink.height * scale
  };
}

export const settleLate = (page: Page, text: string) =>
  page
    .getByTestId('editor-stage')
    .frameLocator('iframe')
    .first()
    .getByText(text, { exact: true })
    .evaluate((el) => void ((el as HTMLElement).style.marginTop = '60px'));

export const drawnBox = (outline: Locator): Promise<Box> =>
  outline.evaluate((el) => {
    const poly = el as SVGPolygonElement;
    const m = poly.getScreenCTM()!;
    const pts = [...poly.points].map((p) => new DOMPoint(p.x, p.y).matrixTransform(m));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys)
    };
  });

export const gap = (a: Box, b: Box) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.width - b.width), Math.abs(a.height - b.height));

export async function expectOutlined(page: Page, outline: Locator, text: string, label: string) {
  await expect(outline).toHaveCount(1, { timeout: 15_000 });
  await expect
    .poll(async () => gap(await drawnBox(outline), await inkOf(page, text)), {
      timeout: 10_000,
      message: `${label}: the outline sits on the element as drawn`
    })
    .toBeLessThanOrEqual(TOLERANCE_PX);
}
