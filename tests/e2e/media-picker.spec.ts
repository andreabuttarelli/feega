import type { Locator, Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import splitDoc from './fixtures/split-headline.json' with { type: 'json' };

const RED = 'tests/e2e/fixtures/red-square.png';
const BLUE_LINK = 'https://raw.githubusercontent.com/andreabuttarelli/feega/dev/tests/e2e/fixtures/blue-square.png';
const BLUE: Rgb = [0, 0, 255];
const ASSET_ID = /^[0-9a-f-]{36}$/;
const STILL = { frame: 120 };
const SHOTS = process.env.MEDIA_PICKER_SHOTS;
const SOME_PIXELS = 0.002;

type Rgb = [number, number, number];
type Clip = { component: string; props: Record<string, unknown> };
type Tracks = { tracks: { clips: Clip[] }[] };
type Doc = Tracks & { comps?: Record<string, Tracks> };

async function shoot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
  }
}

async function share(page: Page, where: Locator, [r, g, b]: Rgb): Promise<number> {
  const png = (await where.screenshot()).toString('base64');
  return page.evaluate(
    async ({ png, r, g, b }) => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0);
      const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
      let hits = 0;
      for (let i = 0; i < data.length; i += 4) {
        hits += Math.abs(data[i] - r) < 40 && Math.abs(data[i + 1] - g) < 40 && Math.abs(data[i + 2] - b) < 40 ? 1 : 0;
      }
      return hits / (data.length / 4);
    },
    { png, r, g, b }
  );
}

async function splitMedia(admin: SupabaseClient, canvasId: string): Promise<unknown> {
  const { data: nodes } = await admin.from('nodes').select('id').eq('canvas_id', canvasId).eq('type', 'motion').is('deleted_at', null);
  const nodeId = nodes?.[0]?.id;
  if (!nodeId) {
    return undefined;
  }
  const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1);
  const doc = data?.[0]?.doc as Doc | undefined;
  const comps = Object.values(doc?.comps ?? {});
  return [doc, ...comps].flatMap((d) => d?.tracks ?? []).flatMap((t) => t.clips).find((c) => c.props.name === 'SplitHeadline')?.props.media;
}

test.use({ video: SHOTS ? 'on' : 'off' });

test.describe('media picker @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack vero: E2E_REAL_STACK=1');
  test.describe.configure({ mode: 'serial' });

  test('Customise a template: upload a picture, insert, the frame shows it; replace it with a link', async ({ page, session, admin }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);

    await page.getByTestId('frame-templates').click();
    const library = page.getByRole('dialog', { name: 'Frame templates' });
    await library.getByTestId('component-search').fill('split headline');
    await library.getByRole('button', { name: 'Customise Split headline' }).click();
    const detail = page.getByTestId('component-detail');
    const picker = detail.getByRole('group', { name: 'Image or video' });
    await expect(picker).toBeVisible();
    await expect(detail).not.toContainText('id or link');
    await shoot(page, '01-empty');

    await picker.getByTestId('media-add').click();
    await shoot(page, '02-chooser');
    await picker.getByTestId('media-file').setInputFiles(RED);
    await expect(picker.getByTestId('media-preview').locator('img')).toBeVisible({ timeout: 60_000 });
    await shoot(page, '03-uploaded');
    await expect.poll(() => share(page, detail.getByTestId('detail-preview'), [255, 0, 0]), { timeout: 20_000, message: 'the customised preview shows the upload' }).toBeGreaterThan(SOME_PIXELS);
    await shoot(page, '04-preview');

    await detail.getByTestId('insert-component').click();
    await expect(page.locator('[data-testid=motion-node]')).toHaveCount(1, { timeout: 15_000 });
    await expect.poll(() => splitMedia(admin, session.canvasId), { timeout: 15_000, message: 'the frame keeps the uploaded asset id' }).toMatch(/^[0-9a-f-]{36}$/);
    const frame = page.locator('[data-testid=motion-node]');
    await expect.poll(() => share(page, frame, [255, 0, 0]), { timeout: 30_000, message: 'the frame on the canvas renders the upload' }).toBeGreaterThan(SOME_PIXELS);
    await shoot(page, '05-inserted');

    await page.getByTestId('motion-node-stage').dblclick();
    const inspector = page.getByTestId('motion-inspector');
    const editing = page.getByRole('group', { name: 'Image or video' }).first();
    await expect(async () => {
      if (!(await editing.isVisible())) {
        await page.getByRole('tab', { name: 'Properties' }).click();
      }
      await expect(editing).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 30_000 });
    await expect(inspector.or(page.locator('body'))).not.toContainText('id or link');
    await shoot(page, '06-editor');

    await editing.getByTestId('media-replace').click();
    await editing.getByTestId('media-tab-link').click();
    await editing.getByTestId('media-link').fill(BLUE_LINK);
    await editing.getByTestId('media-link-check').click();
    await expect(editing.getByTestId('media-link-preview').locator('img')).toBeVisible();
    await shoot(page, '07-link');
    await editing.getByTestId('media-link-use').click();
    await expect.poll(() => splitMedia(admin, session.canvasId), { timeout: 30_000, message: 'the link is copied into the project and stored as an asset id' }).toMatch(ASSET_ID);
    await shoot(page, '08-replaced');
  });

  test('a link set on a composition prop shows in the editor, on the canvas and in a PNG export', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: { ...splitDoc, still: STILL }, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByTestId('motion-node-stage').dblclick();
    const picker = page.getByRole('group', { name: 'Image or video' }).first();
    await expect(async () => {
      if (!(await picker.isVisible())) {
        await page.getByRole('tab', { name: 'Properties' }).click();
      }
      await expect(picker).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 30_000 });

    await picker.getByTestId('media-add').click();
    await picker.getByTestId('media-tab-link').click();
    await picker.getByTestId('media-link').fill(BLUE_LINK);
    await picker.getByTestId('media-link-check').click();
    await picker.getByTestId('media-link-use').click();
    await expect.poll(() => splitMedia(admin, session.canvasId), { timeout: 30_000, message: 'the link is copied into the project' }).toMatch(ASSET_ID);
    await expect.poll(() => share(page, page.getByTestId('motion-preview'), BLUE), { timeout: 30_000, message: 'the editor preview shows the linked picture' }).toBeGreaterThan(SOME_PIXELS);
    await shoot(page, 'link-01-editor');

    await page.getByTestId('export-open').click();
    await expect(page.getByTestId('still-export-go')).toBeEnabled({ timeout: 30_000 });
    await page.getByTestId('still-export-go').click();
    const file = page.getByTestId('still-export-file');
    await expect(file).toBeVisible({ timeout: 90_000 });
    const exported = await page.evaluate(async ({ url, rgb }) => {
      const bitmap = await createImageBitmap(await (await fetch(url as string)).blob());
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0);
      const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
      let hits = 0;
      for (let i = 0; i < data.length; i += 4) {
        hits += Math.abs(data[i] - rgb[0]) < 40 && Math.abs(data[i + 1] - rgb[1]) < 40 && Math.abs(data[i + 2] - rgb[2]) < 40 ? 1 : 0;
      }
      return hits / (data.length / 4);
    }, { url: await file.getAttribute('href'), rgb: BLUE });
    expect(exported, 'the PNG export shows the linked picture').toBeGreaterThan(SOME_PIXELS);
    await shoot(page, 'link-02-export');

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const frame = page.locator('[data-testid=motion-node]');
    await expect.poll(() => share(page, frame, BLUE), { timeout: 60_000, message: 'the frame on the canvas shows the linked picture' }).toBeGreaterThan(SOME_PIXELS);
    await shoot(page, 'link-03-canvas');
  });
});
