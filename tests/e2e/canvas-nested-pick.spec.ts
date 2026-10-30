import { homedir } from 'node:os';
import { mkdirSync, readFileSync } from 'node:fs';
import type { Locator, Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const SHOTS = `${homedir()}/Documents/feega-videos/editor-modes`;
const nested = JSON.parse(readFileSync(new URL('./fixtures/nested-pick-doc.json', import.meta.url), 'utf8'));
const TEXT_AT = { x: 0.2, y: 0.5 };
const OTHER_AT = { x: 0.6, y: 0.5 };

async function pointIn(stage: Locator, share: { x: number; y: number }) {
  const box = (await stage.boundingBox())!;
  return { x: box.x + box.width * share.x, y: box.y + box.height * share.y };
}

const hoveredId = (page: Page) => page.getByTestId('frame-pick-box').getAttribute('data-hovered');

async function hoverAt(page: Page, at: { x: number; y: number }, mods: 'ControlOrMeta' | null = null) {
  if (mods) {
    await page.keyboard.down(mods);
  }
  await page.mouse.move(at.x - 3, at.y);
  await page.mouse.move(at.x, at.y);
  await expect(page.getByTestId('frame-pick-box')).toBeVisible();
  const id = await hoveredId(page);
  if (mods) {
    await page.keyboard.up(mods);
  }
  return id;
}

test.describe('nested pick like Figma @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('hover shows what a click selects, double-click descends, Esc goes up', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    mkdirSync(SHOTS, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: nested.doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const stage = page.locator(`[data-testid="frame-overlays"] [data-frame="${node.id}"]`);
    await expect(stage).toBeVisible({ timeout: 20_000 });
    const overText = await pointIn(stage, TEXT_AT);
    const overOther = await pointIn(stage, OTHER_AT);

    await expect.poll(() => hoverAt(page, overText), { timeout: 25_000 }).toBe(nested.section);
    await page.screenshot({ path: `${SHOTS}/pick-hover-top.png` });
    expect(await hoverAt(page, overText, 'ControlOrMeta')).toBe(nested.text);
    await page.screenshot({ path: `${SHOTS}/pick-hover-deep.png` });

    await page.mouse.click(overText.x, overText.y);
    await expect(page.getByTestId('frame-selection')).toBeVisible();
    await page.mouse.dblclick(overText.x, overText.y);
    expect(await hoverAt(page, overOther)).toBe(nested.other);
    await page.screenshot({ path: `${SHOTS}/pick-inside-section.png` });

    await page.mouse.dblclick(overText.x, overText.y);
    await page.keyboard.press('Escape');
    expect(await hoverAt(page, overText)).toBe(nested.card);
    await page.screenshot({ path: `${SHOTS}/pick-esc-up.png` });
  });
});
