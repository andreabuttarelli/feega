import { homedir } from 'node:os';
import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { setColour } from './fixtures/colour';

const SHOTS = process.env.FIG_SHOTS ?? `${homedir()}/Documents/feega-videos/e2e`;
const SETTLE_MS = 2500;
const WORD = 5;
const HANDLE_DRAG_PX = 40;
const STOP_FROM = '#ff0066';
const STOP_TO = '#00ccff';

const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  still: { frame: 0 },
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 'title', component: 'Text', from: 0, durationInFrames: 150, props: { text: 'Hello world', size: 0.12, x: 0.5, y: 0.5, width: 0.8, height: 0.4 } }] }],
  comps: {},
  assets: []
};

async function paintStops(page: Page) {
  const stops = page.getByTestId('range-gradient-stop');
  await setColour(page, stops.nth(0), STOP_FROM);
  await setColour(page, stops.nth(1), STOP_TO);
}

type Run = { start: number; end: number; fill?: { type: string; stops: unknown[] } };
type Head = { tracks: { clips: { props: { runs?: Run[] } }[] }[] };

test.describe('gradient fill on a text selection @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');

  test('a linear gradient on one word, handles dragged, lands in the doc', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const host = page.locator(`[data-testid="frame-overlays"] [data-frame="${frame.id}"]`);
    await expect(host).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    const box = (await host.boundingBox())!;
    await page.mouse.click(box.x + 4, box.y + 4);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);

    const field = page.getByTestId('core-text-edit');
    await expect(field).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('End');
    for (let i = 0; i < WORD; i++) {
      await page.keyboard.press('Shift+ArrowLeft');
    }
    await expect(page.getByTestId('range-text-inspector')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('range-fill-type').selectOption('linear-gradient');
    await paintStops(page);
    await expect(page.getByTestId('core-text-edit').locator('span[style*="background-clip"]').first()).toBeVisible();
    const start = page.getByTestId('gradient-start');
    await expect(start).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${SHOTS}/textgrad2-1-linear-handles.png` });

    const at = (await start.boundingBox())!;
    await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
    await page.mouse.down();
    await page.mouse.move(at.x + at.width / 2 + HANDLE_DRAG_PX, at.y + at.height / 2 + HANDLE_DRAG_PX, { steps: 8 });
    await page.mouse.up();
    await page.screenshot({ path: `${SHOTS}/textgrad2-2-linear-dragged.png` });

    await page.mouse.click(box.x + box.width + 120, box.y - 40);
    await expect(field).toHaveCount(0);
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/textgrad2-3-linear-canvas.png` });

    const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', frame.id).order('version', { ascending: false }).limit(1);
    const runs = (data?.[0]?.doc as Head).tracks[0].clips[0].props.runs ?? [];
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ start: 6, end: 11 });
    expect(runs[0].fill?.type).toBe('linear-gradient');
  });

  test('a radial gradient on the whole text', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const host = page.locator(`[data-testid="frame-overlays"] [data-frame="${frame.id}"]`);
    await expect(host).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    const box = (await host.boundingBox())!;
    await page.mouse.click(box.x + 4, box.y + 4);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);

    const field = page.getByTestId('core-text-edit');
    await expect(field).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('ControlOrMeta+a');
    await expect(page.getByTestId('range-text-inspector')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('range-fill-type').selectOption('radial-gradient');
    await paintStops(page);
    await expect(page.getByTestId('core-text-edit').locator('span[style*="background-clip"]').first()).toBeVisible();
    await expect(page.getByTestId('gradient-handles')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${SHOTS}/textgrad2-4-radial-handles.png` });

    await page.mouse.click(box.x + box.width + 120, box.y - 40);
    await expect(field).toHaveCount(0);
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/textgrad2-5-radial-canvas.png` });

    const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', frame.id).order('version', { ascending: false }).limit(1);
    const runs = (data?.[0]?.doc as Head).tracks[0].clips[0].props.runs ?? [];
    expect(runs[0]?.fill?.type).toBe('radial-gradient');
  });
});
