import sharp from 'sharp';
import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const TITLE_CLIP = 'title';
const SETTLE_MS = 2500;
const LIT_LUMA = 60;
const KEPT_LIGHT = 0.5;
const SAMPLE_MS = 3000;
const SAMPLE_EVERY_MS = 100;
const OTHER_NODE = { x: 1100, y: 80 };
const FIELD = 'core-text-edit';

const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  still: { frame: 0 },
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: TITLE_CLIP, component: 'Text', from: 0, durationInFrames: 150, props: { text: 'Hello world', size: 0.12, x: 0.5, y: 0.5, width: 0.7, height: 0.25 } }] }],
  comps: {},
  assets: []
};

enum Exit {
  EmptyCanvas = 'a click on the empty canvas',
  DoubleElsewhere = 'a double click elsewhere',
  OtherFrame = 'a click on another frame',
  Escape = 'Escape'
}

async function firstLine(admin: SupabaseClient, nodeId: string): Promise<string> {
  const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1);
  const head = data?.[0]?.doc as { tracks: { clips: { id: string; props: { text?: string } }[] }[] } | undefined;
  return head?.tracks.flatMap((t) => t.clips).find((c) => c.id === TITLE_CLIP)?.props.text?.split('\n')[0] ?? '';
}

const frameHost = (page: Page, nodeId: string) => page.locator(`[data-testid="frame-overlays"] [data-frame="${nodeId}"]`);

async function litShare(page: Page, nodeId: string): Promise<number> {
  const clip = (await frameHost(page, nodeId).boundingBox())!;
  const { data, info } = await sharp(await page.screenshot({ clip })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let lit = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2] > LIT_LUMA) {
      lit++;
    }
  }
  return lit / (data.length / info.channels);
}

async function leave(page: Page, exit: Exit, otherId: string) {
  const pane = (await page.locator('.svelte-flow').first().boundingBox())!;
  const empty = { x: pane.x + pane.width - 40, y: pane.y + pane.height - 40 };
  if (exit === Exit.EmptyCanvas) {
    await page.mouse.click(empty.x, empty.y);
    return;
  }
  if (exit === Exit.DoubleElsewhere) {
    await page.mouse.dblclick(empty.x, empty.y);
    return;
  }
  if (exit === Exit.OtherFrame) {
    const other = (await frameHost(page, otherId).boundingBox())!;
    await page.mouse.click(other.x + 40, other.y + 10);
    return;
  }
  await page.keyboard.press('Escape');
}

test.describe('a frame text edited in place is kept @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  for (const exit of Object.values(Exit)) {
    test(`leaving with ${exit} saves the text, never flashes black, survives a reload`, async ({ page, session, admin, seedNode }) => {
      test.setTimeout(150_000);
      const node = await seedNode({ type: 'motion', x: 80, y: 80, data: LANDSCAPE });
      const other = await seedNode({ type: 'motion', ...OTHER_NODE, data: LANDSCAPE });
      for (const id of [node.id, other.id]) {
        const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
        expect(error).toBeNull();
      }

      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      const host = frameHost(page, node.id);
      await expect(host).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(SETTLE_MS);
      await expect.poll(() => litShare(page, node.id), { timeout: 15_000 }).toBeGreaterThan(0);
      const lit = await litShare(page, node.id);
      const box = (await host.boundingBox())!;

      await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
      const field = page.getByTestId(FIELD);
      await expect(field).toBeVisible({ timeout: 15_000 });
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.type('KEPT');

      await leave(page, exit, other.id);
      await expect(field, 'leaving closes the editor').toHaveCount(0, { timeout: 2_000 });

      for (let at = 0; at < SAMPLE_MS; at += SAMPLE_EVERY_MS) {
        expect(await litShare(page, node.id), `no black frame ${at} ms after leaving`).toBeGreaterThan(lit * KEPT_LIGHT);
      }
      await expect.poll(() => firstLine(admin, node.id), { timeout: 10_000, message: 'nothing writes the old text back after closing' }).toBe('KEPT');

      await page.reload();
      await expect.poll(() => firstLine(admin, node.id), { timeout: 5_000 }).toBe('KEPT');
    });
  }
});
