import { homedir } from 'node:os';
import type { Locator, Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { pickBarTool } from './fixtures/canvas-bar';
import { test, expect, REAL_STACK, gotoHydrated, type E2eSession } from './fixtures/session';

const SHOTS = process.env.FIG_SHOTS ?? `${homedir()}/Documents/feega-videos/e2e`;
const SENTENCE = 'This sentence is sixty characters long and must stay on one.';
const ZOOM_IN_PRESSES: Record<number, number> = { 1: 0, 2: 4 };
const ZOOMS = [1, 2] as const;
const SECOND_LINE = 'Two';
const TINY_DRAG_PX = 5;
const SETTLE_MS = 2500;
const GLYPH_INSET_PX = { x: 15, y: 11 };
const ONE_LINE_RATIO = 3;
const SLACK_PX = 4;

test.use({ headless: !process.env.E2E_HEADED, launchOptions: { args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'] } });

type Clip = { component: string; props: Record<string, unknown> };

const blankFrame = { version: 5, fps: 30, width: 1920, height: 1080, durationInFrames: 150, background: 'brand', still: { frame: 0 }, tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [] }], comps: {}, assets: [] };

async function textClip(admin: SupabaseClient, session: E2eSession): Promise<Clip | undefined> {
  const { data: nodes } = await admin.from('nodes').select('id').eq('canvas_id', session.canvasId).is('deleted_at', null);
  for (const node of nodes ?? []) {
    const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1);
    const clips = (data?.[0]?.doc as { tracks: { clips: Clip[] }[] } | undefined)?.tracks.flatMap((t) => t.clips) ?? [];
    const text = clips.find((c) => c.component === 'Text');
    if (text) {
      return text;
    }
  }
  return undefined;
}

async function textNode(admin: SupabaseClient, session: E2eSession): Promise<{ id: string } | undefined> {
  const { data } = await admin.from('nodes').select('id, type').eq('canvas_id', session.canvasId).is('deleted_at', null).eq('type', 'element');
  return data?.[0] ?? undefined;
}

async function zoomTo(page: Page, zoom: number) {
  const pane = (await page.locator('.svelte-flow').boundingBox())!;
  await page.mouse.move(pane.x + pane.width * 0.8, pane.y + pane.height * 0.8);
  await page.keyboard.press('Shift+Digit0');
  for (let i = 0; i < ZOOM_IN_PRESSES[zoom]; i++) {
    await page.keyboard.press('+');
  }
  await page.waitForTimeout(400);
}

async function typedLines(field: Locator): Promise<number> {
  return field.evaluate((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const tops = new Set<number>();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const range = document.createRange();
      range.selectNodeContents(node);
      [...range.getClientRects()].forEach((r) => tops.add(Math.round(r.top)));
    }
    return tops.size;
  });
}

async function expectAutoWidth(page: Page, admin: SupabaseClient, session: E2eSession, shot: string) {
  const field = page.getByTestId('core-text-edit');
  await expect(field).toBeFocused({ timeout: 15_000 });
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(SENTENCE);
  const box = (await field.boundingBox())!;
  expect(await typedLines(field), 'no wrap while typing').toBe(1);
  expect(box.height, 'one line').toBeLessThan(box.width / ONE_LINE_RATIO);
  await page.keyboard.press('Enter');
  await page.keyboard.type(SECOND_LINE);
  expect(await typedLines(field), 'only Enter makes a new line').toBe(2);
  for (let i = 0; i <= SECOND_LINE.length; i++) {
    await page.keyboard.press('Backspace');
  }
  expect(await typedLines(field), 'back to one line').toBe(1);

  await page.keyboard.press('Escape');
  await expect(field).toHaveCount(0);
  await expect.poll(async () => (await textClip(admin, session))?.props.sizing, { timeout: 10_000 }).toBe('auto');
  const pane = (await page.locator('.svelte-flow').boundingBox())!;
  await page.mouse.click(pane.x + pane.width * 0.5, pane.y + pane.height * 0.9);
  await page.waitForTimeout(SETTLE_MS);
  await page.screenshot({ path: `${SHOTS}/newtext2-${shot}.png`, clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: box.width + 16, height: box.height * 3 } });
  const node = await textNode(admin, session);
  if (node) {
    const tile = (await page.locator(`[data-motion-node="${node.id}"]`).boundingBox())!;
    expect(tile.height, 'the free text node is one line tall').toBeLessThan(tile.width / ONE_LINE_RATIO);
    expect(tile.width, 'the node is as wide as the typed line').toBeGreaterThanOrEqual(box.width - SLACK_PX);
  }
}

async function openFrame(page: Page, admin: SupabaseClient, session: E2eSession, seedNode: (n: { type: string } & Record<string, unknown>) => Promise<{ id: string }>) {
  const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
  const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: blankFrame, actor_kind: 'user', actor_id: session.userId });
  expect(error).toBeNull();
  await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
  const host = page.locator(`[data-testid="frame-overlays"] [data-frame="${frame.id}"]`);
  await expect(host).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(SETTLE_MS);
  return host;
}

test.describe('every new text is auto width @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');
  test.use({ viewport: { width: 1600, height: 1000 } });

  for (const zoom of ZOOMS) {
    test(`text tool click, zoom ${zoom}`, async ({ page, session, admin }) => {
      test.setTimeout(150_000);
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      await zoomTo(page, zoom);
      await pickBarTool(page, 'text');
      const pane = (await page.locator('.svelte-flow').boundingBox())!;
      await page.mouse.click(pane.x + pane.width * 0.2, pane.y + pane.height * 0.4);
      await expectAutoWidth(page, admin, session, `click-z${zoom}`);
    });

    test(`Shift+T and click, zoom ${zoom}`, async ({ page, session, admin }) => {
      test.setTimeout(150_000);
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      await zoomTo(page, zoom);
      const pane = (await page.locator('.svelte-flow').boundingBox())!;
      await page.mouse.click(pane.x + pane.width * 0.5, pane.y + pane.height * 0.15);
      await page.keyboard.press('Shift+T');
      await page.mouse.click(pane.x + pane.width * 0.2, pane.y + pane.height * 0.4);
      await expectAutoWidth(page, admin, session, `shortcut-z${zoom}`);
    });

    test(`a tiny drag with the text tool counts as a click, zoom ${zoom}`, async ({ page, session, admin }) => {
      test.setTimeout(150_000);
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      await zoomTo(page, zoom);
      await pickBarTool(page, 'text');
      const pane = (await page.locator('.svelte-flow').boundingBox())!;
      const at = { x: pane.x + pane.width * 0.2, y: pane.y + pane.height * 0.4 };
      await page.mouse.move(at.x, at.y);
      await page.mouse.down();
      await page.mouse.move(at.x + TINY_DRAG_PX, at.y + TINY_DRAG_PX / 2);
      await page.mouse.up();
      await expectAutoWidth(page, admin, session, `tinydrag-z${zoom}`);
    });

    test(`text tool inside a frame, zoom ${zoom}`, async ({ page, session, admin, seedNode }) => {
      test.setTimeout(150_000);
      const host = await openFrame(page, admin, session, seedNode);
      await zoomTo(page, zoom);
      const stage = (await host.boundingBox())!;
      await page.mouse.click(stage.x + 4, stage.y + 4);
      await pickBarTool(page, 'text');
      const at = { x: stage.x + stage.width * 0.05, y: stage.y + stage.height * 0.4 };
      await page.mouse.click(at.x, at.y);
      await page.waitForTimeout(SETTLE_MS);
      const field = page.getByTestId('core-text-edit');
      if (!(await field.count())) {
        await page.mouse.dblclick(at.x + GLYPH_INSET_PX.x, at.y + GLYPH_INSET_PX.y);
      }
      await expectAutoWidth(page, admin, session, `frame-z${zoom}`);
    });
  }
});
