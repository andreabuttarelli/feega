import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';

enum Anchor {
  Left = 'left',
  Right = 'right',
  Centre = 'centre'
}

const CHROME = {
  topLeft: { selector: '.top-group.left', anchor: Anchor.Left },
  topRight: { selector: '.top-group.right', anchor: Anchor.Right },
  rail: { selector: 'nav.rail', anchor: Anchor.Left },
  addBar: { selector: '[data-testid="add-bar"]', anchor: Anchor.Centre }
};
const DATA_DELAY_MS = 4_000;
const TOLERANCE_PX = 1;

type Boxes = Record<keyof typeof CHROME, number[] | null>;

function boxesIn(page: Page, root: string): Promise<Boxes> {
  return page.evaluate(
    ([scope, chrome]) =>
      Object.fromEntries(
        Object.entries(chrome).map(([key, { selector, anchor }]) => {
          const box = document.querySelector(`${scope} ${selector}`)?.getBoundingClientRect();
          if (!box) {
            return [key, null];
          }
          const edge = { left: box.left, right: box.right, centre: box.left + box.width / 2 }[anchor];
          return [key, [edge, box.top, box.height]];
        })
      ) as Boxes,
    [root, CHROME] as const
  );
}

test.describe('the canvas entry skeleton is the loaded chrome @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack reale: E2E_REAL_STACK=1');

  test('top bar, rail and add bar do not move when the canvas lands', async ({ page, session }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const canvasPath = `/p/${session.projectId}/c/${session.canvasId}`;

    await gotoHydrated(page, '/app');
    await page.route(/\/c\/[^/]+\/__data\.json/, async (route) => {
      await new Promise((settle) => setTimeout(settle, DATA_DELAY_MS));
      await route.continue();
    });
    await page.evaluate((href) => {
      const link = document.createElement('a');
      link.href = href;
      link.dataset.testid = 'enter-canvas';
      document.body.append(link);
    }, canvasPath);
    await page.getByTestId('enter-canvas').dispatchEvent('click');

    await expect(page.getByTestId('canvas-entry-skeleton')).toBeVisible();
    const skeleton = await boxesIn(page, '.canvas-entry');

    await page.waitForURL(canvasPath);
    await expect(page.locator('.project-shell [data-testid="add-bar"]')).toBeVisible({ timeout: 30_000 });
    const loaded = await boxesIn(page, '.project-shell');

    for (const key of Object.keys(CHROME) as (keyof typeof CHROME)[]) {
      expect(skeleton[key], key).not.toBeNull();
      skeleton[key]!.forEach((value, i) => expect(Math.abs(value - loaded[key]![i]), key).toBeLessThanOrEqual(TOLERANCE_PX));
    }
  });
});
