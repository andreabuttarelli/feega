import { homedir } from 'node:os';
import { mkdirSync } from 'node:fs';
import type { Locator, Page } from '@playwright/test';
import { withSurface } from '@feega/motion-core/motion/surface';
import { landingDoc } from '@feega/motion-core/motion/codegen/fixtures/landing';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = `${homedir()}/Documents/feega-videos/editor-modes`;
const SIZE = { width: 1440, height: 4480 };
const DATA = { format: 'custom', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const VIEWPORT = { width: 1440, height: 900 };
const TABLET = 'tablet';

const HEADLINE = { x: 720, y: 300 };
const ACTIONS = { x: 720, y: 517 };
const NAV = { x: 300, y: 40 };

async function pointIn(stage: Locator, at: { x: number; y: number }) {
  const box = (await stage.boundingBox())!;
  const scale = box.width / SIZE.width;
  return { x: box.x + at.x * scale, y: box.y + at.y * scale };
}

async function hoverAt(page: Page, at: { x: number; y: number }, mods: 'ControlOrMeta' | null = null, outline = 'frame-pick-box') {
  if (mods) {
    await page.keyboard.down(mods);
  }
  await page.mouse.move(at.x - 3, at.y);
  await page.mouse.move(at.x, at.y);
  const box = page.getByTestId(outline);
  const id = (await box.count()) ? await box.getAttribute('data-hovered') : null;
  if (mods) {
    await page.keyboard.up(mods);
  }
  return id;
}

const selectedClip = async (page: Page) => {
  const marks = page.getByTestId('frame-selection');
  return (await marks.count()) ? await marks.first().getAttribute('data-clip') : null;
};

test.describe('a frame picks its children like Figma @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');

  test('hover and click reach the child under the pointer, never the page that fills the frame', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    mkdirSync(SHOTS, { recursive: true });
    await page.setViewportSize(VIEWPORT);
    const node = await seedNode({ type: 'motion', x: 200, y: 200, data: DATA });
    await admin.from('nodes').update(SIZE).eq('id', node.id);
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: withSurface(landingDoc(), 'surface'), actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.locator('[data-canvas-surface]')).toHaveAttribute('data-renderer', 'core', { timeout: 30_000 });
    const tile = page.locator(`[data-testid="gpu-node"][data-id="${node.id}"]`);
    await expect(tile).toBeVisible({ timeout: 30_000 });

    const headline = await pointIn(tile, HEADLINE);
    await expect.poll(() => hoverAt(page, headline), { timeout: 30_000 }).toBe('hero');
    await page.screenshot({ path: `${SHOTS}/pick-regress-hover-child.png` });
    expect(await hoverAt(page, headline, 'ControlOrMeta')).toBe('headline');
    expect(await hoverAt(page, await pointIn(tile, NAV))).toBe('nav');

    await page.mouse.click(headline.x, headline.y);
    await expect.poll(() => selectedClip(page)).toBe('hero');
    await page.screenshot({ path: `${SHOTS}/pick-regress-click-child.png` });

    const actions = await pointIn(tile, ACTIONS);
    await page.mouse.dblclick(actions.x, actions.y);
    await expect.poll(() => selectedClip(page)).toBe('hero-actions');
    await page.screenshot({ path: `${SHOTS}/pick-regress-descend.png` });
    await page.keyboard.press('Escape');
    await expect.poll(() => selectedClip(page)).toBe('hero');
    await page.keyboard.press('Escape');
    await expect.poll(() => selectedClip(page)).toBeNull();

    const tablet = page.locator(`[data-frame="${node.id}@bp:${TABLET}"]`).first();
    await expect(tablet).toBeVisible();
    const box = (await tablet.boundingBox())!;
    const inView = { x: box.x + box.width / 2, y: box.y + box.width * (HEADLINE.y / SIZE.width) };
    await expect.poll(() => hoverAt(page, inView, null, 'view-pick-box')).toBe('hero');
    await page.mouse.click(inView.x, inView.y);
    await expect.poll(() => selectedClip(page)).toBe('hero');
    await page.screenshot({ path: `${SHOTS}/pick-regress-breakpoint-view.png` });
  });
});
