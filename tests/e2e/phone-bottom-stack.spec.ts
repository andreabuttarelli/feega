import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Locator, Page } from '@playwright/test';
import motion from './fixtures/motion-doc.json' with { type: 'json' };

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const PHONES = [
  { name: 'iphone', width: 390, height: 844 },
  { name: 'android', width: 412, height: 915 }
];
const MIN_TARGET_PX = 44;
const SHOTS = process.env.DS_SHOTS;

type Box = { x: number; y: number; width: number; height: number };

const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function boxOf(target: Locator): Promise<Box> {
  await expect(target).toBeVisible();
  return (await target.boundingBox())!;
}

async function expectStackClear(page: Page, below: Locator) {
  const viewport = page.viewportSize()!;
  const bar = await boxOf(page.getByTestId('add-bar'));
  const view = await boxOf(below);
  const others = [page.locator('.runs'), page.getByRole('status').filter({ hasText: /sav/i })];

  expect(overlaps(bar, view), `bar ${JSON.stringify(bar)} overlaps the view switch ${JSON.stringify(view)}`).toBe(false);
  for (const other of others) {
    if (!(await other.count()) || !(await other.first().isVisible())) {
      continue;
    }
    const box = (await other.first().boundingBox())!;
    expect(overlaps(box, bar) || overlaps(box, view), `${JSON.stringify(box)} sits under the bottom stack`).toBe(false);
  }
  for (const [name, box] of [['bar', bar], ['view switch', view]] as const) {
    expect(box.x, `${name} left edge`).toBeGreaterThanOrEqual(0);
    expect(box.y, `${name} top edge`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `${name} right edge`).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height, `${name} bottom edge`).toBeLessThanOrEqual(viewport.height);
  }
  for (const button of await page.getByTestId('add-bar').getByRole('button').all()) {
    if (!(await button.isVisible())) {
      continue;
    }
    const b = (await button.boundingBox())!;
    if (b.width <= 1 && b.height <= 1) {
      continue;
    }
    expect(b.height, 'a bar button is tappable').toBeGreaterThanOrEqual(MIN_TARGET_PX);
    expect(b.x + b.width, 'a bar button is inside the screen').toBeLessThanOrEqual(viewport.width);
  }
}

test.describe('on a phone the bottom controls never cover each other @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack reale: E2E_REAL_STACK=1');

  for (const phone of PHONES) {
    test(`${phone.name}: browsing and with a frame open`, async ({ page, session, admin, seedNode }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: phone.width, height: phone.height });
      const node = await seedNode({ type: 'motion', x: 20, y: 80, data: LANDSCAPE });
      await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: motion, actor_kind: 'user', actor_id: session.userId });

      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      await expect(page.getByTestId('add-bar')).toHaveAttribute('data-context', 'canvas');
      if (SHOTS) {
        await page.screenshot({ path: `${SHOTS}/mobile-${process.env.DS_TAG ?? 'after'}-canvas-${phone.name}.png` });
      }
      await expectStackClear(page, page.getByTestId('mobile-view-switch'));

      await page.getByTestId('open-motion-editor').click();
      await expect(page.getByTestId('add-bar')).toHaveAttribute('data-context', 'frame', { timeout: 15_000 });
      const timeline = page.locator('section[aria-label="Timeline"]');
      await expect
        .poll(async () => (await boxOf(timeline)).y - ((await boxOf(page.getByTestId('add-bar'))).y + (await boxOf(page.getByTestId('add-bar'))).height), { timeout: 5_000, message: 'the bar settles right above the timeline' })
        .toBeGreaterThanOrEqual(0);
      if (SHOTS) {
        await page.screenshot({ path: `${SHOTS}/mobile-${process.env.DS_TAG ?? 'after'}-frame-${phone.name}.png` });
      }
      await expect(page.getByTestId('mobile-view-switch'), 'the frame brings its own Properties / Agent switch').toHaveCount(0);
      const lead = (await page.getByTestId('editor-bar').locator('[data-mode="design"]').boundingBox())!;
      expect(lead.x, 'Design is on screen, not pushed past the left edge').toBeGreaterThanOrEqual(0);
      const close = (await page.getByTestId('inline-close').boundingBox())!;
      expect(close.x + close.width, 'closing the frame is always one tap away').toBeLessThanOrEqual(phone.width);
      await expectStackClear(page, page.locator('section[aria-label="Timeline"]'));
    });
  }
});
