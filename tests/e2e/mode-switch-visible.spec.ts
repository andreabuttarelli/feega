import { mkdirSync } from 'node:fs';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Locator, Page } from '@playwright/test';
import motion from './fixtures/motion-doc.json' with { type: 'json' };

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
enum Bar {
  InCanvasBar = 'in-canvas-bar',
  OwnRow = 'own-row'
}
const STAGE = 'motion-node-stage';
enum Open {
  Click = 'click',
  Double = 'dblclick'
}
const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900, open: Open.Click, bar: Bar.InCanvasBar },
  { name: 'desktop-1280', width: 1280, height: 800, open: Open.Click, bar: Bar.InCanvasBar },
  { name: 'desktop-1024', width: 1024, height: 768, open: Open.Click, bar: Bar.InCanvasBar },
  { name: 'ipad', width: 820, height: 1180, open: Open.Click, bar: Bar.InCanvasBar },
  { name: 'ipad-landscape', width: 1180, height: 820, open: Open.Click, bar: Bar.InCanvasBar },
  { name: 'iphone', width: 390, height: 844, open: Open.Double, bar: Bar.OwnRow }
];
const STILL_FRAME = 30;
const SETTLE_MS = 700;
const MIN_TIMELINE_PX = 80;
const LONG_PROJECT = 'Spring campaign for the Milano flagship store launch';
const LONG_CANVAS = 'Hero video variations for Instagram reels and stories';
const FRAMES = [
  { name: 'video', doc: motion, mode: 'video' },
  { name: 'still', doc: { ...motion, still: { frame: STILL_FRAME } }, mode: 'still' }
];
const SHOTS = process.env.MODE_SWITCH_SHOTS;

async function shoot(page: Page, name: string) {
  if (!SHOTS) {
    return;
  }
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

async function expectReachable(page: Page, button: Locator, label: string) {
  const viewport = page.viewportSize()!;
  await expect(button, `${label} is visible`).toBeVisible();
  const box = (await button.boundingBox())!;
  expect(box.width * box.height, `${label} has an area`).toBeGreaterThan(0);
  expect(box.x, `${label} left edge`).toBeGreaterThanOrEqual(0);
  expect(box.y, `${label} top edge`).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, `${label} right edge`).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height, `${label} bottom edge`).toBeLessThanOrEqual(viewport.height);
  const onTop = await button.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return !!hit && (hit === el || el.contains(hit));
  });
  expect(onTop, `${label} is not clipped or covered`).toBe(true);
}

test.describe('the Design | Motion switch on a frame opened on the canvas @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');
  test.setTimeout(120_000);

  for (const viewport of VIEWPORTS) {
    for (const frame of FRAMES) {
      test(`${viewport.name}, ${frame.name} frame: the switch is visible and clickable`, async ({ page, session, admin, seedNode }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        const node = await seedNode({ type: 'motion', x: 80, y: 120, data: LANDSCAPE });
        const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: frame.doc, actor_kind: 'user', actor_id: session.userId });
        expect(error).toBeNull();
        await admin.from('projects').update({ name: LONG_PROJECT }).eq('id', session.projectId);
        await admin.from('canvases').update({ name: LONG_CANVAS }).eq('id', session.canvasId);

        await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
        await page.locator(`.svelte-flow__node[data-id="${node.id}"]`).getByTestId(STAGE)[viewport.open]({ position: { x: 10, y: 10 } });
        const editor = page.getByTestId('motion-editor');
        await expect(editor).toHaveAttribute('data-mount', 'canvas', { timeout: 15_000 });
        await expect(editor).toHaveAttribute('data-mode', frame.mode);
        await expect(page.getByTestId('editor-stage')).toHaveAttribute('data-shown', 'true', { timeout: 15_000 });
        await page.waitForTimeout(SETTLE_MS);
        await shoot(page, `${viewport.name}-${frame.name}`);

        const modeSwitch = page.getByTestId('edit-mode');
        const design = modeSwitch.locator('[data-mode="design"]');
        const motionMode = modeSwitch.locator('[data-mode="motion"]');
        await expectReachable(page, design, 'Design');
        await expectReachable(page, motionMode, 'Motion');
        if (viewport.bar === Bar.InCanvasBar) {
          await expect(page.locator('.canvas-topbar .chat-toggle'), 'the canvas bar keeps its right edge on screen').toBeInViewport({ ratio: 1 });
        }

        await design.click();
        await expect(design).toHaveAttribute('aria-checked', 'true');
        await motionMode.click();
        await expect(motionMode).toHaveAttribute('aria-checked', 'true');
        if (frame.mode === 'video') {
          await expect(page.getByRole('region', { name: 'Timeline', exact: true })).toBeVisible();
        }
        await shoot(page, `${viewport.name}-${frame.name}-motion`);
      });
    }
  }

  test('Motion on a one-frame poster opens the timeline and gives the frame a duration, saved', async ({ page, session, admin, seedNode }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const poster = { ...motion, durationInFrames: 1, still: { frame: 0 }, tracks: motion.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, durationInFrames: 1, keyframes: {} })) })) };
    const node = await seedNode({ type: 'motion', x: 80, y: 120, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: poster, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.locator(`.svelte-flow__node[data-id="${node.id}"]`).getByTestId(STAGE).click({ position: { x: 10, y: 10 } });
    await expect(page.getByTestId('editor-stage')).toHaveAttribute('data-shown', 'true', { timeout: 15_000 });
    const modeSwitch = page.getByTestId('edit-mode');
    await modeSwitch.locator('[data-mode="design"]').click();
    await modeSwitch.locator('[data-mode="motion"]').click();

    const timeline = page.getByRole('region', { name: 'Timeline', exact: true });
    await expect(timeline).toBeVisible();
    await expect.poll(async () => (await timeline.boundingBox())?.height ?? 0, { message: 'the timeline opens' }).toBeGreaterThan(MIN_TIMELINE_PX);
    await expect(timeline, 'the timeline slides into view').toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId('animate-hint')).toHaveText('Animate this frame — add keyframes at the playhead');
    await page.waitForTimeout(SETTLE_MS);
    await shoot(page, 'poster-motion');
    const savedFrames = async () => (await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1).single()).data?.doc?.durationInFrames ?? 0;
    await expect.poll(savedFrames, { timeout: 15_000, message: 'the longer frame is saved' }).toBeGreaterThan(1);

    await modeSwitch.locator('[data-mode="design"]').click();
    await page.waitForTimeout(SETTLE_MS);
    expect(await savedFrames(), 'Design keeps the duration').toBeGreaterThan(1);
  });
});
