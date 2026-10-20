import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Locator, Page } from '@playwright/test';
import doc from './fixtures/motion-doc.json' with { type: 'json' };

const SHORT = { width: 1280, height: 700 };
const SHOTS = process.env.RIGHT_BAR_SHOTS;
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const WHEEL_DELTA = 400;
const PX_SLACK = 1;

async function shoot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
  }
}

async function addElement(page: Page, label: string) {
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('menuitem', { name: label, exact: true }).dispatchEvent('click');
}

async function lastSection(page: Page): Promise<Locator> {
  const sections = page.locator('aside.props [data-section]');
  await expect(sections.first()).toBeVisible({ timeout: 15_000 });
  return sections.last();
}

async function reachable(page: Page, target: Locator) {
  const pane = page.locator('aside.props');
  await target.scrollIntoViewIfNeeded();
  const box = (await target.boundingBox())!;
  const paneBox = (await pane.boundingBox())!;
  expect(box.y + box.height, 'the last section ends inside the panel').toBeLessThanOrEqual(paneBox.y + paneBox.height + PX_SLACK);
  expect(box.y + box.height, 'the last section ends inside the window').toBeLessThanOrEqual(SHORT.height + PX_SLACK);
  expect(await shiftedAncestors(target), 'scrolling the bar never shifts the editor around it').toEqual([]);
  await target.locator('summary, header, h3, button').first().click({ timeout: 5_000 });
}

async function shiftedAncestors(target: Locator): Promise<string[]> {
  return target.evaluate((el) => {
    const pane = el.closest('aside.props');
    const shifted: string[] = [];
    for (let up = pane?.parentElement; up; up = up.parentElement) {
      if (up.scrollTop || up.scrollLeft) {
        shifted.push(`${up.tagName.toLowerCase()}.${up.className}`);
      }
    }
    return shifted;
  });
}

async function viewportOf(page: Page): Promise<string> {
  return page.locator('.svelte-flow__viewport').evaluate((el) => (el as HTMLElement).style.transform);
}

test.describe('the right bar scrolls @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('canvas: the last Properties section scrolls into view and the wheel scrolls the bar, not the canvas', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(SHORT);
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });
    await expect(page.getByTestId('motion-editor')).toHaveAttribute('data-mount', 'canvas', { timeout: 15_000 });
    await page.getByTestId('side-tab-properties').dispatchEvent('click');
    await addElement(page, 'Title');
    const last = await lastSection(page);
    await shoot(page, 'canvas-before');

    const before = await viewportOf(page);
    const box = (await page.getByTestId('right-bar').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, WHEEL_DELTA);
    expect(await viewportOf(page), 'the wheel over the bar does not zoom or pan the canvas').toBe(before);
    await expect.poll(() => page.locator('aside.props').evaluate((el) => el.scrollTop), { message: 'the wheel scrolls the bar' }).toBeGreaterThan(0);

    await reachable(page, last);
    await shoot(page, 'canvas-after');
  });
});
