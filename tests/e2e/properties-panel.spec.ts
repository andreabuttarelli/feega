import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Locator, Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import poster from './fixtures/poster-type-grid.json' with { type: 'json' };

const LANDSCAPE = { format: 'landscape', docHeadRevision: 0, posterAssetId: null, lastRenderAssetId: null };
const PORTRAIT = { format: '4:5', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const SHOTS = process.env.PROPERTIES_SHOTS;
const VIEWPORT = { width: 1440, height: 900 };
const LAPTOP = { width: 1280, height: 720 };
const PX_SLACK = 2;

type Clip = { id: string; component: string; props: Record<string, unknown>; transform: Record<string, unknown> };

async function shoot(target: Locator, name: string) {
  if (SHOTS) {
    await target.screenshot({ path: `${SHOTS}/${name}.png` });
  }
}

async function latestClips(admin: SupabaseClient, nodeId: string): Promise<Clip[]> {
  const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1);
  const doc = data?.[0]?.doc as { tracks: { clips: Clip[] }[] } | undefined;
  return doc?.tracks.flatMap((t) => t.clips) ?? [];
}

async function addElement(page: Page, label: string) {
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('menuitem', { name: label, exact: true }).dispatchEvent('click');
}

const sectionsOf = (panel: Locator) => panel.getByTestId('motion-inspector').locator('[data-section]').evaluateAll((all) => all.map((s) => s.getAttribute('data-section')));

test.describe('properties panel @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');
  test.describe.configure({ mode: 'serial' });

  test('every selection kind shows its sections; a value edited in Properties is saved', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(VIEWPORT);
    const node = await seedNode({ type: 'motion', data: LANDSCAPE });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`);
    const props = page.locator('aside.props');
    await page.getByRole('tab', { name: 'Properties' }).click();

    await expect(page.getByTestId('composition-inspector')).toBeVisible({ timeout: 15_000 });
    await expect(props.getByTestId('selection-head')).toContainText('Frame');
    await shoot(props, 'frame');

    await addElement(page, 'Title');
    await expect(props.getByTestId('selection-head')).toContainText('Title');
    expect(await sectionsOf(props)).toEqual(expect.arrayContaining(['layout', 'layer', 'fill', 'text']));
    await expect(props.locator('[data-section="text"] [data-segmented="Align"]')).toBeVisible();
    await shoot(props, 'text-clip');

    const opacity = props.locator('[data-section="layer"] input.num[aria-label="Opacity"]');
    await opacity.fill('40');
    await opacity.press('Enter');
    await expect
      .poll(async () => (await latestClips(admin, node.id)).find((c) => c.component === 'Title')?.transform.opacity, { timeout: 10_000 })
      .toBe(0.4);

    await props.locator('[data-section="text"] [data-segmented="Align"] [aria-label="Align left"]').click();
    await expect
      .poll(async () => (await latestClips(admin, node.id)).find((c) => c.component === 'Title')?.props.align, { timeout: 10_000 })
      .toBe('left');

    const colour = props.locator('[data-section="fill"] input.hex').first();
    await colour.fill('ff00aa');
    await colour.press('Enter');
    await expect
      .poll(async () => (await latestClips(admin, node.id)).find((c) => c.component === 'Title')?.props.color, { timeout: 10_000 })
      .toBe('#ff00aa');

    await addElement(page, 'Shape');
    await expect(props.getByTestId('selection-head')).toContainText('Shape');
    expect(await sectionsOf(props)).toEqual(expect.arrayContaining(['layout', 'layer', 'fill', 'stroke', 'shape']));
    await shoot(props, 'shape');

    await addElement(page, 'Image');
    await expect(props.getByTestId('selection-head')).toContainText('Image');
    expect(await sectionsOf(props)).not.toContain('text');
    await shoot(props, 'image-clip');

    await page.locator('body').click({ position: { x: 2, y: 2 } });
    await page.keyboard.press('ControlOrMeta+a');
    const multi = page.getByTestId('multi-inspector');
    await expect(multi).toBeVisible();
    await expect(multi.locator('input.num[aria-label="Opacity"]')).toHaveAttribute('placeholder', 'Mixed');
    await shoot(props, 'multiple');
  });

  test('on the canvas the panel runs full height; a poster line and a photo part show their own properties', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(LAPTOP);
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: PORTRAIT });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: poster, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });
    await expect(page.getByTestId('motion-editor')).toHaveAttribute('data-mode', 'still', { timeout: 15_000 });
    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    const layers = page.getByTestId('layers');
    await page.getByTestId('side-tab-properties').dispatchEvent('click');
    const side = page.locator('aside.props');

    await layers.locator('[data-layer="poster#lines:1"]').click();
    await expect(page.getByTestId('part-text')).toHaveValue('NAME', { timeout: 15_000 });

    const editor = (await page.getByTestId('motion-editor').boundingBox())!;
    const panel = (await page.locator('aside.props').boundingBox())!;
    expect(Math.abs(panel.y - editor.y), 'the panel starts right under the top bar').toBeLessThanOrEqual(PX_SLACK);
    expect(Math.abs(panel.height - (LAPTOP.height - editor.y)), 'it runs the full height left under the top bar').toBeLessThanOrEqual(PX_SLACK);
    const overflow = await page.locator('aside.props').evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow, 'no row is wider than the panel').toBeLessThanOrEqual(0);
    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/canvas-full-height.png` });
    }
    await shoot(side, 'poster-line');

    await layers.locator('[data-layer="poster#photos:0"]').click();
    await expect(page.getByTestId('part-photo')).toBeVisible();
    await expect(side.locator('[data-colour="Poster colour"]'), 'a photo never shows the whole poster style').toHaveCount(0);
    await expect(side.getByText('Runtime variable prefix')).toHaveCount(0);
    await shoot(side, 'photo-part');
  });
});
