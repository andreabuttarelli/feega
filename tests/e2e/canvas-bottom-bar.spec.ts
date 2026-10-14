import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';
import poster from './fixtures/poster-type-grid.json' with { type: 'json' };
import motion from './fixtures/motion-doc.json' with { type: 'json' };

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const PORTRAIT = { format: '4:5', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const SHOTS = process.env.CANVAS_MOTION_SHOTS;

type Clip = { id: string; props: { lines?: string; media?: unknown[] } };

async function shoot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
  }
}

async function clickPart(page: Page, button: 'left' | 'right') {
  const box = (await page.getByTestId('part-box').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button });
}

test.describe('one bottom bar, by context @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('canvas tools while browsing, frame tools while a frame is open, no floating toolbar; a photo deletes itself', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: PORTRAIT });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: poster, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    const posterClip = async (): Promise<Clip | undefined> => {
      const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1);
      const doc = data?.[0]?.doc as { tracks: { clips: Clip[] }[] } | undefined;
      return doc?.tracks.flatMap((t) => t.clips).find((c) => c.id === 'poster');
    };

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const bar = page.getByTestId('add-bar');
    await expect(bar).toHaveAttribute('data-context', 'canvas');
    await expect(bar.getByRole('button', { name: 'Upload file' })).toBeVisible();
    await expect(page.getByTestId('draw-tools')).toHaveCount(0);
    await shoot(page, '1-canvas-tools');

    await page.getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });
    await expect(page.getByTestId('motion-editor')).toBeVisible({ timeout: 15_000 });
    await expect(bar).toHaveAttribute('data-context', 'frame');
    await expect(page.getByTestId('draw-tools'), 'one draw toolbar, the one in the bar').toHaveCount(1);
    await expect(bar.getByTestId('draw-tools')).toBeVisible();
    await expect(page.getByTestId('editor-stage').getByTestId('draw-tools')).toHaveCount(0);
    await expect(bar.getByRole('button', { name: 'Upload file' })).toHaveCount(0);
    await bar.locator('[data-tool="ellipse"]').click();
    await expect(bar.locator('[data-tool="ellipse"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('motion-editor'), 'a bar click keeps the frame open').toBeVisible();
    await page.keyboard.press('Shift+R');
    await expect(bar.locator('[data-tool="rectangle"]'), 'shortcuts unchanged').toHaveAttribute('aria-pressed', 'true');
    await shoot(page, '2-frame-tools');
    await page.keyboard.press('v');
    await expect(bar.locator('[data-tool="select"]')).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    const layers = page.getByTestId('layers');
    await layers.locator('[data-layer="poster#lines:1"]').click();
    await expect(page.getByTestId('part-text')).toHaveValue('NAME');
    await expect(page.getByTestId('poster-part').getByRole('button', { name: /Photo/ }), 'a line keeps only its text').toHaveCount(0);
    await shoot(page, '3-line-no-photo-buttons');

    await clickPart(page, 'right');
    await page.getByTestId('part-menu').getByRole('menuitem', { name: 'Insert photo after' }).click();
    await expect.poll(async () => (await posterClip())?.props.lines?.split('\n')[1], { timeout: 10_000 }).toBe('NAME [photo] [photo]');
    await layers.locator('[data-layer="poster#photos:1"]').click();
    await clickPart(page, 'left');
    await expect(page.getByTestId('poster-part')).toHaveAttribute('data-kind', 'photo');
    await page.keyboard.press('Delete');
    await expect.poll(async () => (await posterClip())?.props.lines?.split('\n')[1], { timeout: 10_000 }).toBe('NAME [photo]');

    const before = (await posterClip())!;
    await layers.locator('[data-layer="poster#photos:0"]').click();
    await expect(page.getByTestId('poster-part')).toHaveAttribute('data-kind', 'photo');
    await shoot(page, '4-photo-selected');
    await page.getByTestId('part-delete').click();
    await expect.poll(async () => (await posterClip())?.props.lines?.split('\n')[1], { timeout: 10_000 }).toBe('NAME');
    const after = (await posterClip())!;
    expect(after.props.media?.length ?? 0).toBe(Math.max((before.props.media?.length ?? 0) - 1, 0));
    await shoot(page, '5-photo-deleted');

    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(bar).toHaveAttribute('data-context', 'canvas', { timeout: 10_000 });
    await expect(page.getByTestId('draw-tools')).toHaveCount(0);
    await shoot(page, '6-back-to-canvas');
  });

  test('a frame with a timeline keeps the bar right above it', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: motion, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });
    const bar = page.getByTestId('add-bar');
    await expect(bar).toHaveAttribute('data-context', 'frame', { timeout: 15_000 });
    const timeline = page.locator('section[aria-label="Timeline"]');
    await expect(timeline).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => {
        const [b, t] = await Promise.all([bar.boundingBox(), timeline.boundingBox()]);
        return b && t ? Math.round(t.y - (b.y + b.height)) : null;
      }, { timeout: 5_000 })
      .toBe(0);
    await shoot(page, '7-above-timeline');
  });
});
