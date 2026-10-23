import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { SHOTS_DIR } from './fixtures/shots';
import { figmaClipboardHtml } from '../fixtures/figma/clipboard';
import { cardOverElements, elementsOnly } from '../fixtures/figma/elements';

const REAL_CLIP = readFileSync(new URL('../fixtures/figma/clip-1.html', import.meta.url), 'utf8');
const SETTLE_MS = 3000;
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const EMPTY_FRAME = { version: 5, fps: 30, width: 1920, height: 1080, durationInFrames: 150, background: 'brand', still: { frame: 0 }, tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [] }], comps: {}, assets: [] };

type NodeRow = { id: string; data: { kind?: string } };

const shoot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS_DIR}/figma2-${name}.png` });

async function nodesOf(admin: SupabaseClient, canvasId: string): Promise<NodeRow[]> {
  const { data } = await admin.from('nodes').select('id, data').eq('canvas_id', canvasId).is('deleted_at', null);
  return (data ?? []) as NodeRow[];
}

const kindsOf = async (admin: SupabaseClient, canvasId: string) => (await nodesOf(admin, canvasId)).map((n) => n.data.kind ?? 'frame').sort();

async function clipCount(admin: SupabaseClient, nodeId: string): Promise<number> {
  const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1);
  return (data?.[0]?.doc as { tracks: { clips: unknown[] }[] } | undefined)?.tracks.flatMap((t) => t.clips).length ?? 0;
}

async function putOnClipboard(page: Page, html: string) {
  await page.evaluate(async (body) => {
    await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([body], { type: 'text/html' }), 'text/plain': new Blob(['figma'], { type: 'text/plain' }) })]);
  }, html);
}

async function pasteAt(page: Page, at: { x: number; y: number }) {
  await page.mouse.move(at.x, at.y);
  await page.keyboard.press('ControlOrMeta+v');
}

async function pasteOverCanvas(page: Page) {
  await page.waitForTimeout(SETTLE_MS);
  const pane = (await page.locator('.svelte-flow').boundingBox())!;
  const middle = { x: pane.x + pane.width * 0.55, y: pane.y + pane.height * 0.62 };
  await page.mouse.click(pane.x + pane.width * 0.9, pane.y + pane.height * 0.9);
  await pasteAt(page, middle);
}

test.use({ permissions: ['clipboard-read', 'clipboard-write'], viewport: { width: 1600, height: 900 } });

test.describe('figma paste keeps the kind of what was copied @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('a copied frame lands as a frame', async ({ page, session, admin }) => {
    test.setTimeout(120_000);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await putOnClipboard(page, REAL_CLIP);
    await pasteOverCanvas(page);

    await expect.poll(() => kindsOf(admin, session.canvasId), { timeout: 30_000 }).toEqual(['frame']);
    await page.waitForTimeout(SETTLE_MS);
    await shoot(page, '1-frame');
  });

  test('copied shapes, text and a group land as free elements, no frame', async ({ page, session, admin }) => {
    test.setTimeout(120_000);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await putOnClipboard(page, figmaClipboardHtml(elementsOnly()));
    await pasteOverCanvas(page);

    await expect.poll(() => kindsOf(admin, session.canvasId), { timeout: 30_000 }).toEqual(['element', 'element', 'element', 'group']);
    await page.waitForTimeout(SETTLE_MS);
    await shoot(page, '2-elements');
  });

  test('a frame copied with elements around it: one frame, the rest free', async ({ page, session, admin }) => {
    test.setTimeout(120_000);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await putOnClipboard(page, figmaClipboardHtml(cardOverElements()));
    await pasteOverCanvas(page);

    await expect.poll(() => kindsOf(admin, session.canvasId), { timeout: 30_000 }).toEqual(['element', 'element', 'element', 'frame', 'group']);
    await page.waitForTimeout(SETTLE_MS);
    await shoot(page, '3-mixed');
  });

  test('pasted over an existing frame, everything goes inside it', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: EMPTY_FRAME, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.waitForTimeout(SETTLE_MS);

    const stage = (await page.locator(`[data-frame="${frame.id}"]`).boundingBox())!;
    await putOnClipboard(page, figmaClipboardHtml(elementsOnly()));
    await pasteAt(page, { x: stage.x + stage.width / 2, y: stage.y + stage.height / 2 });

    await expect.poll(() => clipCount(admin, frame.id), { timeout: 30_000 }).toBeGreaterThan(0);
    expect(await kindsOf(admin, session.canvasId)).toEqual(['frame']);
    await page.waitForTimeout(SETTLE_MS);
    await shoot(page, '4-inside-frame');
  });
});
