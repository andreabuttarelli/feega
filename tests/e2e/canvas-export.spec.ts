import { unzipSync } from 'fflate';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SQUARE = { format: '1:1', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

const frameDoc = {
  version: 5,
  fps: 30,
  width: 1080,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  still: { frame: 0 },
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 'a', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.3, y: 0.5, width: 0.2, height: 0.2 } }] }],
  comps: {},
  assets: []
};

test.describe('export a selection @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('two frames with two settings download as one zip of four images', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    const ids: string[] = [];
    for (const x of [80, 1400]) {
      const frame = await seedNode({ type: 'motion', x, y: 80, data: SQUARE });
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: frameDoc, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
      ids.push(frame.id);
    }

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.locator(`.svelte-flow__node[data-id="${ids[0]}"]`).click({ position: { x: 4, y: 4 } });
    await page.locator(`.svelte-flow__node[data-id="${ids[1]}"]`).click({ position: { x: 4, y: 4 }, modifiers: ['Shift'] });
    await page.locator(`.svelte-flow__node[data-id="${ids[1]}"]`).click({ button: 'right', position: { x: 4, y: 4 } });
    await page.getByRole('menuitem', { name: /Export/ }).click();

    const dialog = page.getByTestId('export-dialog');
    await expect(dialog).toContainText('2 frames');
    await page.getByTestId('export-add').click();
    const second = page.getByTestId('export-row').nth(1);
    await second.getByLabel('Size', { exact: true }).fill('0.5');
    await second.getByLabel('Size', { exact: true }).blur();
    await second.getByLabel('Suffix').fill('@half');
    await second.getByLabel('Suffix').blur();
    await page.getByTestId('export-go').click();

    const link = page.getByTestId('export-file');
    await expect(link.or(dialog.getByRole('alert'))).toBeVisible({ timeout: 120_000 });
    await expect(dialog.getByRole('alert'), 'the export draws, it does not fail').toHaveCount(0);
    const href = (await link.getAttribute('href'))!;
    const zip = unzipSync(new Uint8Array(await (await page.request.get(href)).body()));
    const names = Object.keys(zip).sort();

    expect(names).toHaveLength(4);
    expect(names.filter((n) => n.endsWith('@half.png'))).toHaveLength(2);
    expect([...zip[names[0]].slice(0, 4)]).toEqual(PNG_MAGIC);
  });
});
