import { test } from '@playwright/test';
import { installCursor, recordDemo } from '../record';
import { LUMEN_PATH, serveLumen } from '../../../tests/e2e/fixtures/interactive-routes';

const LUMEN_DIR = process.env.LUMEN_DIR;
const INTRO_MS = 2200;
const HOVER_MS = 450;
const SCROLL_STEPS = 20;
const SCROLL_STEP_PX = 24;
const SCROLL_FRAME_MS = 45;
const VIEW = { width: 1600, height: 900 };
const CTA = { x: 0.1725 * VIEW.width, y: 0.79 * VIEW.height };

test('interactive video on gpu-core', async ({ page, baseURL }) => {
  if (!LUMEN_DIR) {
    throw new Error('Build the page first: npx vite-node tests/e2e/fixtures/build-lumen.ts <dir> <origin>, then set LUMEN_DIR=<dir>');
  }
  const origin = new URL(baseURL!).origin;
  await page.addInitScript(() => {
    (window as unknown as { open: () => null }).open = () => null;
  });
  await installCursor(page);
  await serveLumen(page, origin, LUMEN_DIR);
  await page.goto(`${origin}${LUMEN_PATH}`);
  await page.waitForSelector('feega-motion iframe');
  await page.waitForTimeout(2500);

  await recordDemo(page, { slug: 'interactive-gpu-core', title: 'interactive videos on gpu-core' }, async (d) => {
    await page.frames().find((f) => f.url().includes('/e/lumen-hero'))!.evaluate(() => {
      const hero = document.querySelector('feega-gpu-player') as HTMLElement & { seek: (t: number) => void; play: () => void };
      hero.seek(0);
      hero.play();
    });
    await d.wait(INTRO_MS);
    await d.move({ x: 1300, y: 620 });
    await d.wait(HOVER_MS);
    await d.click(CTA);
    await d.move({ x: 1000, y: 450 });
    for (let step = 0; step < SCROLL_STEPS; step++) {
      await page.mouse.wheel(0, SCROLL_STEP_PX);
      await d.wait(SCROLL_FRAME_MS);
    }
    await d.wait(HOVER_MS);
  });
});
