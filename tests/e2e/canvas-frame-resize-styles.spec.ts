import type { Page, Request } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SETTLE_MS = 2500;
const STEPS = 8;
const STEP_PX = 12;
const HELD_MS = 1200;
const LABEL_ABOVE_PX = 14;
const LABEL_IN_PX = 8;
const UNDO_SLACK_PX = 2;
const STYLE_SAVE = /name="summary"\r?\n\r?\n[^\r\n]*\bstyle\b/i;

const BODY = { kind: 'text', font: 'Inter', size: 0.05, weight: 400, tracking: 0, leading: 1.4, textCase: 'as-typed' };

const styledDoc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  still: { frame: 0 },
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 't', component: 'Text', from: 0, durationInFrames: 150, styleRef: 'Body', props: { text: 'Styled', size: 0.05, x: 0.5, y: 0.5, width: 0.6, height: 0.25 } }] }],
  comps: {},
  assets: [],
  styles: { Body: BODY }
};

const PAGE_SIZE = { width: 400, height: 300 };

const pageDoc = { ...styledDoc, width: PAGE_SIZE.width, height: PAGE_SIZE.height, still: undefined };

const savedSummary = (r: Request, nodeId: string) => (r.method() === 'POST' && r.url().includes(`/motion/${nodeId}`) ? (r.postDataBuffer()?.toString() ?? '') : null);

async function styleSaves(page: Page, nodeId: string): Promise<() => string[]> {
  const seen: string[] = [];
  page.on('request', (r) => {
    const body = savedSummary(r, nodeId);
    if (body !== null && STYLE_SAVE.test(body)) {
      seen.push(body);
    }
  });
  return () => [...seen];
}

test.describe('resizing a frame leaves its styles alone @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');

  test('no style is rewritten or saved while the corner is held, nor after it lands or is undone', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: 200, y: 150, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: styledDoc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const tile = page.locator(`[data-testid="gpu-node"][data-id="${node.id}"]`);
    await expect(tile).toBeAttached({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);

    const box = (await tile.boundingBox())!;
    await page.mouse.click(box.x + LABEL_IN_PX, box.y - LABEL_ABOVE_PX);
    await page.waitForTimeout(SETTLE_MS);
    const saves = await styleSaves(page, node.id);

    const corner = { x: box.x + box.width, y: box.y + box.height };
    await page.mouse.move(corner.x, corner.y);
    await page.mouse.down();
    for (let i = 1; i <= STEPS; i++) {
      await page.mouse.move(corner.x - i * STEP_PX, corner.y - i * STEP_PX * 0.3);
    }
    await page.waitForTimeout(HELD_MS);
    const resizing = (await tile.boundingBox())!;
    const midGesture = saves();
    await page.mouse.up();
    await page.waitForTimeout(SETTLE_MS);

    expect(resizing.width, 'the frame follows the corner').toBeLessThan(box.width - STEP_PX);
    expect(midGesture, 'nothing writes a style while the corner is held').toEqual([]);
    expect(saves(), 'the resize keeps its styles at their pixel size, so nothing is pushed back after it lands').toEqual([]);

    await page.keyboard.press('ControlOrMeta+z');
    await page.waitForTimeout(SETTLE_MS);
    expect(Math.abs((await tile.boundingBox())!.width - box.width), 'undo puts the frame back to its size').toBeLessThan(UNDO_SLACK_PX);
    expect(saves(), 'undoing the resize writes no style either').toEqual([]);
  });

  test('narrowing a frame to its minimum and undoing puts back its box and its doc, with no style step between', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: 200, y: 150, data: { format: 'custom', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    expect((await admin.from('nodes').update(PAGE_SIZE).eq('id', node.id)).error).toBeNull();
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: pageDoc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    const docWidth = async () => {
      const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1).single();
      return (data?.doc as { width?: number } | null)?.width;
    };
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const tile = page.locator(`[data-testid="gpu-node"][data-id="${node.id}"]`);
    await expect(tile).toBeAttached({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);

    const box = (await tile.boundingBox())!;
    const placed = await tile.getAttribute('data-box');
    await page.mouse.click(box.x + LABEL_IN_PX, box.y - LABEL_ABOVE_PX);
    await page.waitForTimeout(SETTLE_MS);
    const saves = await styleSaves(page, node.id);

    const corner = { x: box.x + box.width, y: box.y + box.height };
    await page.mouse.move(corner.x, corner.y);
    await page.mouse.down();
    for (let i = 1; i <= STEPS; i++) {
      await page.mouse.move(corner.x - (i * (box.width + STEP_PX)) / STEPS, corner.y);
    }
    await page.mouse.up();
    await expect.poll(docWidth, { timeout: 15_000 }).toBeLessThan(PAGE_SIZE.width);
    await page.waitForTimeout(SETTLE_MS);

    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => tile.getAttribute('data-box'), { timeout: 15_000, message: 'undo puts the box back' }).toBe(placed);
    await expect.poll(docWidth, { timeout: 15_000, message: 'undo puts the doc back' }).toBe(PAGE_SIZE.width);

    await page.keyboard.press('ControlOrMeta+z');
    await page.waitForTimeout(SETTLE_MS);
    expect(await tile.getAttribute('data-box'), 'a second undo finds nothing of this frame to undo').toBe(placed);
    expect(saves(), 'no style is written by the narrowing, its landing or its undo').toEqual([]);
  });
});
