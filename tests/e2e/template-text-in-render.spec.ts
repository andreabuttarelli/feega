import type { SupabaseClient } from '@supabase/supabase-js';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import poster from './fixtures/poster-block-title.json' with { type: 'json' };

const PORTRAIT = { format: '4:5', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const BLOCK_TITLE_CLIP = 'poster';
const doc = poster as { tracks: { clips: { id: string; props: Record<string, unknown> }[] }[] };
const byline = String(doc.tracks.flatMap((t) => t.clips).find((c) => c.id === BLOCK_TITLE_CLIP)!.props.byline);

async function savedByline(admin: SupabaseClient, nodeId: string): Promise<string> {
  const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1);
  const saved = data?.[0]?.doc as typeof doc | undefined;
  return String(saved?.tracks.flatMap((t) => t.clips).find((c) => c.id === BLOCK_TITLE_CLIP)?.props.byline ?? '');
}

test.describe('a template text is typed where it is drawn @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('double clicking a library poster text it never tagged edits it in the render and saves it', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: PORTRAIT });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByTestId('motion-node-stage').first().click({ position: { x: 60, y: 10 } });
    const overlay = page.getByTestId('selection-overlay');
    await expect(overlay).toBeVisible({ timeout: 15_000 });

    const frame = page.frameLocator('[data-testid="motion-preview"] iframe').first();
    await expect(frame.locator('[data-part="byline"]'), 'the drawn byline is found by its text').toHaveCount(1, { timeout: 15_000 });
    const iframe = (await page.locator('[data-testid="motion-preview"] iframe').first().boundingBox())!;
    const inner = await frame.locator('[data-part="byline"]').evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight };
    });
    const box = (await overlay.boundingBox())!;
    const at = { x: iframe.x + inner.x * iframe.width - box.x, y: iframe.y + inner.y * iframe.height - box.y };

    await expect(async () => {
      await overlay.click({ position: at });
      await expect(page.getByTestId('selection-box')).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    await overlay.dblclick({ position: at });
    await overlay.dblclick({ position: at });

    await expect(frame.locator('[contenteditable]'), 'typed into the render, not an overlay field').toHaveCount(1, { timeout: 10_000 });
    await expect(page.getByTestId('part-text')).toHaveCount(0);
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('NEW BYLINE');
    await page.keyboard.press('Enter');

    await expect.poll(() => savedByline(admin, node.id), { timeout: 15_000 }).toBe('NEW BYLINE');
    expect(byline).not.toBe('NEW BYLINE');
  });
});
