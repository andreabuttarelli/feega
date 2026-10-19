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
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 'a', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.3, y: 0.5, width: 0.2, height: 0.2 } }, { id: 't', from: 0, durationInFrames: 150, component: 'Text', props: { text: 'Vector words', x: 0.5, y: 0.2 } }] }],
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

  test('SVG keeps text as text and a PDF has one page per frame', async ({ page, session, admin, seedNode }) => {
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
    await page.getByTestId('export-row').first().getByLabel('Format').selectOption('pdf');
    await page.getByTestId('export-add').click();
    await page.getByTestId('export-row').nth(1).getByLabel('Format').selectOption('svg');
    await page.getByTestId('export-go').click();

    const link = page.getByTestId('export-file');
    await expect(link.or(dialog.getByRole('alert'))).toBeVisible({ timeout: 120_000 });
    await expect(dialog.getByRole('alert'), 'the export draws, it does not fail').toHaveCount(0);
    const zip = unzipSync(new Uint8Array(await (await page.request.get((await link.getAttribute('href'))!)).body()));
    const names = Object.keys(zip);
    const pdf = Buffer.from(zip[names.find((n) => n.endsWith('.pdf'))!]).toString('latin1');
    const svgs = names.filter((n) => n.endsWith('.svg'));

    expect(names.filter((n) => n.endsWith('.pdf')), 'one PDF for both frames').toHaveLength(1);
    expect(pdf.match(/\/Type\s*\/Page\b/g), 'a page per frame').toHaveLength(2);
    expect(svgs).toHaveLength(2);
    expect(Buffer.from(zip[svgs[0]]).toString()).toContain('Vector words');
  });

  test('one element inside a frame exports cropped to its own box', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: SQUARE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: frameDoc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);

    const answer = await page.request.post(`/p/${session.projectId}/c/${session.canvasId}?/exportSelection`, {
      headers: { 'x-sveltekit-action': 'true', origin: new URL(page.url()).origin },
      multipart: { elements: JSON.stringify([{ frameId: frame.id, elementId: 'a' }]), rows: JSON.stringify([{ format: 'png', by: 'scale', value: 1 }]) }
    });
    const body = JSON.parse(await answer.text()) as { type: string; data: string };
    expect(body.type, body.data).toBe('success');
    const url = (JSON.parse(body.data) as string[]).find((v) => typeof v === 'string' && v.startsWith('http'))!;
    const png = Buffer.from(await (await page.request.get(url)).body());
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);

    expect(width, 'cropped to the 0.2-wide rect, not the whole frame').toBeLessThan(frameDoc.width / 2);
    expect(height).toBeLessThan(frameDoc.height / 2);
  });
});
