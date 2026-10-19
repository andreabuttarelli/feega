import sharp from 'sharp';
import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import poster from './fixtures/poster-type-grid.json' with { type: 'json' };

const PORTRAIT = { format: '4:5', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const LIT_LUMA = 60;
const KEPT_LIGHT = 0.5;
const SAMPLE_MS = 3000;
const SAMPLE_EVERY_MS = 100;
const OTHER_NODE = { x: 900, y: 80 };

enum Exit {
  EmptyCanvas = 'a click on the empty canvas',
  DoubleElsewhere = 'a double click elsewhere',
  OtherFrame = 'a click on another frame',
  Escape = 'Escape',
  Enter = 'Enter'
}

async function firstLine(admin: SupabaseClient, nodeId: string): Promise<string> {
  const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1);
  const doc = data?.[0]?.doc as { tracks: { clips: { id: string; props: { lines?: string } }[] }[] } | undefined;
  return doc?.tracks.flatMap((t) => t.clips).find((c) => c.id === 'poster')?.props.lines?.split('\n')[0] ?? '';
}

async function litShare(page: Page, nodeId: string): Promise<number> {
  const stage = page.locator(`[data-id="${nodeId}"] [data-testid="motion-node-stage"]`).first();
  const { data, info } = await sharp(await stage.screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
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
    await page.locator(`[data-id="${otherId}"] [data-testid="motion-node-stage"]`).first().click({ position: { x: 40, y: 10 } });
    return;
  }
  await page.keyboard.press(exit === Exit.Escape ? 'Escape' : 'Enter');
}

test.describe('a poster text edited in place is kept @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  for (const exit of Object.values(Exit)) {
    test(`leaving with ${exit} saves the text, never flashes black, survives a reload`, async ({ page, session, admin, seedNode }) => {
      test.setTimeout(150_000);
      const node = await seedNode({ type: 'motion', x: 80, y: 80, data: PORTRAIT });
      const other = await seedNode({ type: 'motion', ...OTHER_NODE, data: PORTRAIT });
      for (const id of [node.id, other.id]) {
        const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: id, version: 1, doc: poster, actor_kind: 'user', actor_id: session.userId });
        expect(error).toBeNull();
      }

      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      const stage = page.locator(`[data-id="${node.id}"] [data-testid="motion-node-stage"]`).first();
      await stage.click({ position: { x: 60, y: 10 } });
      const overlay = page.getByTestId('selection-overlay');
      await expect(overlay).toBeVisible({ timeout: 15_000 });
      await expect.poll(() => litShare(page, node.id), { timeout: 15_000 }).toBeGreaterThan(0);
      const lit = await litShare(page, node.id);
      const box = (await overlay.boundingBox())!;
      const title = { x: box.width * 0.4, y: box.height * 0.1 };
      await expect(async () => {
        await overlay.click({ position: title });
        await expect(page.getByTestId('selection-box')).toBeVisible({ timeout: 1000 });
      }).toPass({ timeout: 15_000 });
      await overlay.dblclick({ position: title });
      await overlay.dblclick({ position: title });

      const frame = page.frameLocator(`[data-testid="motion-preview"] iframe`).first();
      await expect(frame.locator('[contenteditable]')).toHaveCount(1, { timeout: 10_000 });
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.type('KEPT');

      await leave(page, exit, other.id);
      await expect(frame.locator('[contenteditable]'), 'leaving closes the editor').toHaveCount(0, { timeout: 2_000 });

      for (let at = 0; at < SAMPLE_MS; at += SAMPLE_EVERY_MS) {
        expect(await litShare(page, node.id), `no black frame ${at} ms after leaving`).toBeGreaterThan(lit * KEPT_LIGHT);
      }
      expect(await firstLine(admin, node.id), 'nothing writes the old text back after closing').toBe('KEPT');

      await page.reload();
      await expect.poll(() => firstLine(admin, node.id), { timeout: 5_000 }).toBe('KEPT');
    });
  }
});
