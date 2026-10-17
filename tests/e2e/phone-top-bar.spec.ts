import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Locator, Page } from '@playwright/test';
import motion from './fixtures/motion-doc.json' with { type: 'json' };

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const PHONES = [
  { name: 'iphone', width: 390, height: 844 },
  { name: 'android', width: 412, height: 915 }
];
const LONG = 'A very long project name that never fits on a phone screen at all';
const SHOTS = process.env.TOP_BAR_SHOTS;

async function expectInside(page: Page, bar: Locator, what: string) {
  const width = page.viewportSize()!.width;
  await expect(bar).toBeVisible();
  const clipped = await bar.evaluate((el) => [el, ...el.querySelectorAll('*')].filter((n) => n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).overflowX !== 'visible' && getComputedStyle(n).textOverflow !== 'ellipsis').map((n) => n.className || n.tagName));
  expect(clipped, `${what}: nothing scrolls or clips sideways`).toEqual([]);
  for (const control of await bar.locator('button, a, [role="button"]').all()) {
    if (!(await control.isVisible())) {
      continue;
    }
    const b = (await control.boundingBox())!;
    if (b.width <= 1 && b.height <= 1) {
      continue;
    }
    const name = (await control.getAttribute('aria-label')) ?? (await control.textContent())?.trim();
    expect(b.x, `${what}: "${name}" starts on screen`).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, `${what}: "${name}" ends on screen`).toBeLessThanOrEqual(width + 0.5);
  }
  const pageScroll = await page.evaluate(() => document.scrollingElement!.scrollWidth - innerWidth);
  expect(pageScroll, `${what}: the page has no sideways scroll`).toBeLessThanOrEqual(0);
}

test.describe('the phone top bar fits the screen @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack reale: E2E_REAL_STACK=1');

  for (const phone of PHONES) {
    test(`${phone.name}: long names, browsing and with a frame open`, async ({ page, session, admin, seedNode }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: phone.width, height: phone.height });
      await admin.from('projects').update({ name: LONG }).eq('id', session.projectId);
      await admin.from('canvases').update({ name: `${LONG} canvas` }).eq('id', session.canvasId);
      const node = await seedNode({ type: 'motion', x: 20, y: 80, data: LANDSCAPE });
      await admin.from('nodes').update({ display_name: `${LONG} frame` }).eq('id', node.id);
      await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: motion, actor_kind: 'user', actor_id: session.userId });

      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      if (SHOTS) {
        await page.screenshot({ path: `${SHOTS}/${process.env.TOP_BAR_TAG ?? 'after'}-${phone.name}-canvas.png` });
      }
      await expectInside(page, page.locator('header.mobile-topbar'), 'browsing');

      await page.getByTestId('open-motion-editor').click();
      await expect(page.getByTestId('editor-stage')).toBeVisible({ timeout: 20_000 });
      if (SHOTS) {
        await page.screenshot({ path: `${SHOTS}/${process.env.TOP_BAR_TAG ?? 'after'}-${phone.name}-frame.png` });
      }
      await expectInside(page, page.getByTestId('editor-bar'), 'frame open');
      await expect(page.getByTestId('inline-close'), 'closing the frame stays one tap away').toBeVisible();
    });
  }
});
