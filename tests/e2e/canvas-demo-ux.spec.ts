import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SETTLE_MS = 2000;
const SHOTS = process.env.CANVAS_DEMO_SHOTS ?? '/tmp';
const PAGE = { width: 1600, height: 900 };

const video = {
  version: 5,
  fps: 30,
  width: 1000,
  height: 530,
  durationInFrames: 150,
  background: 'brand',
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [] }],
  comps: {},
  assets: []
};

type Clip = { id: string; component: string; from: number; props: Record<string, unknown>; transform: { x?: number } };
type Doc = { tracks: { clips: Clip[] }[] };

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
}

test.describe('the demo flow inside a frame @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('rectangle then text: a double-click on the text edits it', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(PAGE);
    const frame = await seedNode({ type: 'motion', x: 300, y: 110, data: { format: 'custom', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: video, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const host = page.locator(`[data-testid="frame-overlays"] [data-frame="${frame.id}"]`);
    await expect(host).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    const stage = (await host.boundingBox())!;
    const at = (fx: number, fy: number) => ({ x: stage.x + stage.width * fx, y: stage.y + stage.height * fy });
    await page.mouse.click(stage.x + 4, stage.y + 4);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/demo-0-open.png` });
    await expect(page.getByTestId('side-tab-properties'), 'picking a frame opens the panel on Properties').toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('Alt+Shift+R');
    const mark = (await page.getByText('02:00f', { exact: true }).first().boundingBox())!;
    await page.mouse.click(mark.x + 2, mark.y + mark.height / 2);
    await page.waitForTimeout(500);
    await page.keyboard.press('Shift+R');
    await drag(page, at(0.1, 0.1), at(0.6, 0.45));
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/demo-1-rect.png` });
    await page.getByTestId('fill-swatch').first().click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/demo-1a-swatch.png` });
    const hex = page.getByTestId('colour-channel').first();
    await hex.fill('FF3366', { timeout: 5000 });
    await hex.press('Enter');
    await page.waitForTimeout(500);
    await page.mouse.click(at(0.35, 0.3).x, at(0.35, 0.3).y);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/demo-1b-fill.png` });

    await page.keyboard.press('Shift+T');
    await drag(page, at(0.1, 0.6), at(0.5, 0.75));
    await page.waitForTimeout(SETTLE_MS);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/demo-2-text.png` });

    const centre = at(0.3, 0.675);
    await page.mouse.dblclick(centre.x, centre.y);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/demo-3-dblclick.png` });
    const field = page.getByTestId('core-text-edit');
    await expect(field, 'a double-click opens the caret on the text').toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Hello demo', { delay: 60 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(SETTLE_MS);

    const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', frame.id).order('version', { ascending: false }).limit(1);
    const clips = (data?.[0]?.doc as Doc).tracks.flatMap((t) => t.clips);
    expect(clips.find((c) => c.component === 'Text')?.props.text).toBe('Hello demo');
    expect(clips.map((c) => c.from), 'designing with the playhead at 2 s does not stagger new layers').toEqual([0, 0]);

    await page.keyboard.press('Escape');
    await page.keyboard.press('e');
    await page.keyboard.press('Shift+R');
    await drag(page, at(0.7, 0.1), at(0.9, 0.3));
    await page.waitForTimeout(SETTLE_MS);
    const { data: animated } = await admin.from('motion_revisions').select('doc').eq('node_id', frame.id).order('version', { ascending: false }).limit(1);
    const keyed = (animated?.[0]?.doc as Doc).tracks.flatMap((t) => t.clips);
    expect(Math.max(...keyed.map((c) => c.from)), 'in Motion a new layer starts at the playhead').toBeGreaterThan(0);
  });

  test('an image inserted in a frame moves when dragged, and ⌥⌘[ sends it to the back', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(PAGE);
    const frame = await seedNode({ type: 'motion', x: 300, y: 110, data: { format: 'custom', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: video, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const host = page.locator(`[data-testid="frame-overlays"] [data-frame="${frame.id}"]`);
    await expect(host).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    const stage = (await host.boundingBox())!;
    const at = (fx: number, fy: number) => ({ x: stage.x + stage.width * fx, y: stage.y + stage.height * fy });
    await page.mouse.click(stage.x + 4, stage.y + 4);

    await page.keyboard.press('Shift+R');
    await drag(page, at(0.05, 0.05), at(0.95, 0.95));
    await page.waitForTimeout(SETTLE_MS);

    await page.getByTestId('frame-image-input').setInputFiles('tests/e2e/fixtures/blue-square.png');
    await page.waitForTimeout(SETTLE_MS * 2);
    await page.screenshot({ path: `${SHOTS}/demo-4-image.png` });
    const latest = async () => {
      const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', frame.id).order('version', { ascending: false }).limit(1);
      return (data?.[0]?.doc as Doc).tracks.flatMap((t) => t.clips);
    };
    const image = (await latest()).find((c) => c.component !== 'Shape')!;
    const before = { x: Number(image.props.x), y: Number(image.props.y) };
    const centre = at(before.x, before.y);
    await page.mouse.click(centre.x, centre.y);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/demo-4b-image-clicked.png` });
    await drag(page, centre, { x: centre.x + 80, y: centre.y + 40 });
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/demo-5-image-moved.png` });
    const moved = (await latest()).find((c) => c.id === image.id)!;
    expect(moved.transform.x ?? 0).toBeGreaterThan(0);

    await page.keyboard.press('Alt+Meta+BracketLeft');
    await page.waitForTimeout(SETTLE_MS);
    const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', frame.id).order('version', { ascending: false }).limit(1);
    const visual = (data?.[0]?.doc as { tracks: { kind: string; clips: Clip[] }[] }).tracks.filter((t) => t.kind === 'visual');
    expect(visual.at(-1)?.clips.map((c) => c.id)).toEqual([image.id]);
  });
});
