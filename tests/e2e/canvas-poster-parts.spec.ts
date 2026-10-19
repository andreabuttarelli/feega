import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';
import poster from './fixtures/poster-type-grid.json' with { type: 'json' };

const PORTRAIT = { format: '4:5', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const SHOTS = process.env.CANVAS_MOTION_SHOTS;
const TITLE_LINE = 'lines:0';
const TYPED = 'HELLO';

const PINK_RGB = 'rgb(255, 0, 170)';
const INK_RGB = 'rgb(22, 22, 22)';

async function previewColours(page: Page): Promise<(string | null)[][]> {
  const previews = page.frames().filter((f) => f !== page.mainFrame());
  const colours = await Promise.all(
    previews.map((frame) =>
      frame
        .evaluate((ids) => ids.map((id) => {
          const word = document.querySelector(`[data-part="${id}"] .tg-word`);
          return word ? getComputedStyle(word).color : null;
        }), [TITLE_LINE, 'lines:1'])
        .catch(() => [])
    )
  );
  return colours.filter((c) => c.length && c[0]);
}

async function shoot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
  }
}

test.use({ video: SHOTS ? 'on' : 'off' });

test.describe('poster parts on the canvas @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('a poster opens on the canvas; its title is a part: select it, edit it in place, saved', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: PORTRAIT });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: poster, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });
    await expect(page.getByTestId('motion-editor')).toHaveAttribute('data-mode', 'still', { timeout: 15_000 });

    const overlay = page.getByTestId('selection-overlay');
    await expect(overlay).toBeVisible({ timeout: 15_000 });
    const box = (await overlay.boundingBox())!;
    const title = { x: box.width * 0.4, y: box.height * 0.1 };

    await expect(async () => {
      await overlay.dblclick({ position: title });
      await expect(page.getByTestId('selection-box')).toBeVisible({ timeout: 1000 });
    }, 'the poster selects once the preview has measured it').toPass({ timeout: 15_000 });
    await overlay.dblclick({ position: title });
    const part = page.getByTestId('part-box');
    await expect(part).toHaveAttribute('data-part', TITLE_LINE);
    await shoot(page, '8-poster-part');

    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    const layerRow = page.getByTestId('layers').locator(`[data-layer="poster#${TITLE_LINE}"]`);
    await expect(layerRow).toHaveAttribute('aria-selected', 'true');

    const inspector = page.getByTestId('motion-inspector');
    await expect(page.getByTestId('part-text'), 'a line shows only its own text').toHaveValue('STUDIO');
    await expect(inspector.locator('#f-lines'), 'never the raw lines with their markers').toHaveCount(0);
    await expect(inspector.locator('#f-paper'), 'never the poster background').toHaveCount(0);
    await expect(inspector.locator('#f-ink'), 'the colour every line shares hides behind its subsection').toBeHidden();
    await expect(inspector.getByTestId('part-shared')).toContainText('Shared with');
    await expect(inspector.getByTestId('part-fill').getByTestId('fill-row')).toHaveCount(1);
    await shoot(page, '8b-poster-part-properties');

    const pink = '#ff00aa';
    await inspector.getByTestId('part-fill').getByTestId('fill-swatch').click();
    const hex = inspector.getByTestId('part-fill').getByTestId('fill-editor').locator('input.hex');
    await hex.fill(pink);
    await hex.press('Enter');

    await expect
      .poll(async () => {
        const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1);
        const doc = data?.[0]?.doc as { tracks: { clips: { id: string; props: { ink?: string }; partStyles?: Record<string, { fills: { color?: string }[] }> }[] }[] } | undefined;
        const clip = doc?.tracks.flatMap((t) => t.clips).find((c) => c.id === 'poster');
        return [clip?.partStyles?.[TITLE_LINE]?.fills[0]?.color, clip?.props.ink];
      }, { timeout: 10_000 })
      .toEqual([pink, poster.tracks.flatMap((t) => t.clips).find((c) => c.id === 'poster')?.props.ink]);
    await expect
      .poll(async () => (await previewColours(page)).find(([title]) => title === PINK_RGB), { timeout: 15_000 })
      .toEqual([PINK_RGB, INK_RGB]);
    await shoot(page, '8c-poster-part-recoloured');
    await expect(page.getByTestId('editor-stage'), 'an edit never hides the stage behind the old picture').toHaveAttribute('data-shown', 'true');
    await expect(part, 'an edit keeps the part selected while the preview reloads').toHaveAttribute('data-part', TITLE_LINE, { timeout: 500 });

    await layerRow.click();
    await overlay.dblclick({ position: title });
    const field = page.frameLocator('[data-testid="motion-preview"] iframe').first().locator(`[data-part="${TITLE_LINE}"]`);
    await expect(field, 'the line itself becomes editable where it is drawn').toHaveAttribute('contenteditable', /plaintext-only|true/);
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type(TYPED);
    await page.keyboard.press('Enter');
    await shoot(page, '9-poster-edited');

    await expect
      .poll(async () => {
        const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1);
        const doc = data?.[0]?.doc as { tracks: { clips: { id: string; props: { lines?: string } }[] }[] } | undefined;
        return doc?.tracks.flatMap((t) => t.clips).find((c) => c.id === 'poster')?.props.lines?.split('\n')[0];
      }, { timeout: 10_000 })
      .toBe(TYPED);
  });

  test('one selection level; a line is its own text; a photo is its own part', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: PORTRAIT });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: poster, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });
    await expect(page.getByTestId('motion-editor')).toHaveAttribute('data-mode', 'still', { timeout: 15_000 });
    const tile = page.locator(`.svelte-flow__node[data-id="${node.id}"]`);

    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    const layers = page.getByTestId('layers');
    await expect(layers.locator('[data-layer="poster"]')).toContainText('Type grid poster', { timeout: 15_000 });
    const nameRow = layers.locator('[data-layer="poster#lines:1"]');
    await expect(nameRow).toContainText('NAME', { timeout: 15_000 });
    await shoot(page, '14-poster-human-names');

    await nameRow.click();
    await expect(page.getByTestId('motion-inspector')).toContainText('Type grid poster');
    await expect(tile.getByTestId('tile-selection')).toHaveAttribute('data-ring', 'editing');
    await expect(tile.locator('.svelte-flow__resize-control'), 'the frame has no handles while a part is the selection').toHaveCount(0);
    await expect(page.getByTestId('part-text')).toHaveValue('NAME');
    await expect(page.getByTestId('motion-inspector').locator('#f-lines')).toHaveCount(0);
    await shoot(page, '15-line-selected-one-level');

    const photoRow = layers.locator('[data-layer="poster#photos:0"]');
    await expect(photoRow).toContainText('Photo 1');
    await photoRow.click();
    await expect(page.getByTestId('poster-part')).toHaveAttribute('data-kind', 'photo');
    await expect(page.getByTestId('part-photo')).toBeVisible();
    await page.getByTestId('part-photo').getByTestId('fill-add').click();
    await page.getByTestId('part-photo').getByTestId('fill-add-solid').click();
    await shoot(page, '16-photo-part');

    await expect
      .poll(async () => {
        const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1);
        const doc = data?.[0]?.doc as { tracks: { clips: { id: string; props: { media?: { fills?: { type: string }[] }[] } }[] }[] } | undefined;
        return doc?.tracks.flatMap((t) => t.clips).find((c) => c.id === 'poster')?.props.media?.[0]?.fills?.map((f) => f.type);
      }, { timeout: 10_000 })
      .toEqual(['solid']);

    await layers.locator('[data-layer="poster"]').click();
    const lines = page.getByTestId('marked-lines');
    await expect(lines, 'the whole poster edits its lines as a list, never the marker syntax').toBeVisible();
    await expect(lines.getByRole('textbox', { name: 'Line 2' })).toHaveValue('NAME');
    await expect(page.getByTestId('motion-inspector')).not.toContainText('[photo]');
    await shoot(page, '17-poster-lines-editor');
  });

  test('layers lists every frame, hover outlines, one selection with the canvas, a closed child opens its frame', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const first = await seedNode({ type: 'motion', x: 80, y: 80, data: PORTRAIT });
    const second = await seedNode({ type: 'motion', x: 520, y: 80, data: PORTRAIT });
    for (const node of [first, second]) {
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: poster, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
    }

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    const layers = page.getByTestId('layers');
    await expect(layers.locator('[data-layer="poster"]')).toHaveCount(2, { timeout: 15_000 });

    await layers.locator('[data-layer="poster"]').first().hover();
    await expect(page.getByTestId('tile-hover')).toHaveCount(1);
    await shoot(page, '10-layers-hover-closed-frame');

    const firstRow = layers.locator(`[data-layer="${first.id}"]`);
    const secondRow = layers.locator(`[data-layer="${second.id}"]`);
    await firstRow.click();
    await expect(firstRow).toHaveAttribute('aria-selected', 'true');
    await page.locator(`.svelte-flow__node[data-id="${second.id}"]`).getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });
    await expect(secondRow).toHaveAttribute('aria-selected', 'true');
    await expect(firstRow).toHaveAttribute('aria-selected', 'false');
    await shoot(page, '11-layers-one-selection');

    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await layers.locator('[data-layer="poster"]').first().click();
    await expect(page.getByTestId('motion-editor')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('selection-box')).toBeVisible({ timeout: 15_000 });
    await shoot(page, '12-layers-closed-child-opens');

    await layers.locator('[data-layer="poster#lines:1"]').first().hover();
    await expect(page.getByTestId('layer-hover-part')).toBeVisible();
    await shoot(page, '13-layers-hover-part');
  });
});
