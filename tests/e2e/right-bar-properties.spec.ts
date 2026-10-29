import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';
import motion from './fixtures/motion-doc.json' with { type: 'json' };

const SHOTS = process.env.RIGHT_BAR_SHOTS;
const SETTLE_MS = 1500;
const LONG_PRESS_WAIT_MS = 700;
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };

async function shoot(page: Page, name: string) {
  if (!SHOTS) {
    return;
  }
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

const nodeBox = async (page: Page, id: string) => (await page.locator(`[data-testid="gpu-node"][data-id="${id}"]`).boundingBox())!;

async function openProperties(page: Page) {
  const tab = page.getByTestId('side-tab-properties');
  if (!(await tab.isVisible())) {
    await page.getByRole('button', { name: 'Show chat' }).click();
  }
  await tab.click();
}

test.describe('right bar for canvas selections @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(180_000);

  test('generated image, free elements, frame and long-press', async ({ page, session, admin, seedNode }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const refId = randomUUID();
    const { error } = await admin.from('assets').insert({ id: refId, org_id: session.orgId, project_id: session.projectId, type: 'image', source: 'generated' });
    expect(error).toBeNull();
    const image = await seedNode({ type: 'image', x: 0, y: 0, data: { prompt: 'a red sneaker on white', refId } });
    const a = await seedNode({ type: 'text', x: 700, y: 0, data: { text: 'Launch week' } });
    const b = await seedNode({ type: 'text', x: 780, y: 420, data: { text: 'Pricing' } });
    const frame = await seedNode({ type: 'motion', x: 0, y: 900, data: LANDSCAPE });
    const revision = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: motion, actor_kind: 'user', actor_id: session.userId });
    expect(revision.error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.locator('[data-canvas-surface]')).toHaveAttribute('data-renderer', 'core', { timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);

    const imageBox = await nodeBox(page, image.id);
    await page.mouse.click(imageBox.x + imageBox.width / 2, imageBox.y + imageBox.height - 20);
    await openProperties(page);
    const inspector = page.getByTestId('node-inspector');
    await expect(inspector).toBeVisible();
    await expect(inspector.getByTestId('panel-upscale-image')).toBeVisible();
    await expect(inspector.getByTestId('panel-remove-background')).toBeVisible();
    await shoot(page, 'view2-generated-image');

    const boxA = await nodeBox(page, a.id);
    await page.mouse.click(boxA.x + boxA.width / 2, boxA.y + boxA.height / 2);
    const boxB = await nodeBox(page, b.id);
    await page.keyboard.down('Shift');
    await page.mouse.click(boxB.x + boxB.width / 2, boxB.y + boxB.height / 2);
    await page.keyboard.up('Shift');
    await expect(inspector.getByTestId('align-bar')).toBeVisible();
    await inspector.locator('[data-align="left"]').click();
    await expect.poll(async () => Math.round((await nodeBox(page, b.id)).x)).toBe(Math.round((await nodeBox(page, a.id)).x));
    await shoot(page, 'view2-align-free');

    const frameBox = await nodeBox(page, frame.id);
    await page.mouse.click(frameBox.x + 8, frameBox.y + 8);
    await expect(page.getByTestId('frame-actions')).toBeVisible();
    await shoot(page, 'view2-frame-actions');

    await page.keyboard.press('Escape');
    const at = { x: boxA.x + boxA.width / 2, y: boxA.y + boxA.height / 2 };
    await page.locator('[data-canvas-surface] .surface').dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 7, clientX: at.x, clientY: at.y, isPrimary: true, bubbles: true });
    await page.waitForTimeout(LONG_PRESS_WAIT_MS);
    await expect(page.getByRole('menu')).toBeVisible();
    await shoot(page, 'view2-long-press-menu');
    await page.locator('[data-canvas-surface] .surface').dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 7, clientX: at.x, clientY: at.y, bubbles: true });
  });
});
