import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';
import motion from './fixtures/motion-doc.json' with { type: 'json' };

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const CONTROL_PX = 28;
const TOLERANCE_PX = 1;
const SHOTS = process.env.DS_SHOTS;
const TAG = process.env.DS_TAG ?? 'after';

type Control = { name: string; top: number; height: number };

async function topBarControls(page: Page): Promise<Control[]> {
  return page.evaluate(() => {
    const header = document.querySelector('header.canvas-topbar');
    const editor = document.querySelector('[data-testid="editor-bar"]');
    const roots = [header, editor].filter((r): r is Element => !!r);
    const controls = roots.flatMap((root) => [...root.querySelectorAll<HTMLElement>('button, a[href], [role="radiogroup"]')]);
    return controls
      .filter((el) => !el.closest('[role="radiogroup"]') || el.getAttribute('role') === 'radiogroup')
      .filter((el) => !el.closest('[role="menu"]'))
      .map((el) => ({ el, box: el.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 1 && box.height > 1 && box.bottom <= 60)
      .map(({ el, box }) => ({ name: el.getAttribute('aria-label') || el.textContent?.trim() || el.tagName, top: box.top, height: box.height }));
  });
}

async function expectRhythm(page: Page) {
  await expect
    .poll(async () => {
      const controls = await topBarControls(page);
      const off = controls.filter((c) => Math.abs(c.height - CONTROL_PX) > TOLERANCE_PX);
      return off.map((c) => `${c.name}: ${Math.round(c.height)}px`);
    }, { timeout: 5_000, message: `every top-bar control is ${CONTROL_PX}px tall` })
    .toEqual([]);

  const controls = await topBarControls(page);
  const centres = controls.map((c) => c.top + c.height / 2);
  const line = centres[0];
  const stray = controls.filter((_, i) => Math.abs(centres[i] - line) > TOLERANCE_PX).map((c) => c.name);
  expect(stray, 'every top-bar control sits on one centre line').toEqual([]);
}

test.describe('the top bar keeps one rhythm @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack reale: E2E_REAL_STACK=1');

  test('browsing and with a frame open, every control is the same height on one line', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: LANDSCAPE });
    await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: motion, actor_kind: 'user', actor_id: session.userId });

    for (const theme of ['light', 'dark']) {
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      await page.evaluate((v) => document.documentElement.setAttribute('data-theme', v), theme);
      await page.waitForTimeout(800);
      if (SHOTS) {
        await page.screenshot({ path: `${SHOTS}/editor-${TAG}-browsing-1440-${theme}.png` });
      }
      await expectRhythm(page);

      await page.getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });
      await expect(page.getByTestId('editor-bar')).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(1500);
      if (SHOTS) {
        await page.screenshot({ path: `${SHOTS}/editor-${TAG}-frame-1440-${theme}.png` });
        await page.screenshot({ path: `${SHOTS}/editor-${TAG}-topbar-1440-${theme}.png`, clip: { x: 0, y: 0, width: 1440, height: 48 } });
      }
      await expectRhythm(page);
      await expect(page.locator('header.canvas-topbar [data-testid="connection-dot"], header.canvas-topbar .connection-dot')).toHaveCount(0);
    }
  });
});
