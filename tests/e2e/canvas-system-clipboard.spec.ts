import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';

const SHOTS = process.env.CANVAS_CLIPBOARD_SHOTS;
const ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" fill="#ff3b30"/><circle cx="12" cy="12" r="6" fill="#0a84ff"/></svg>';

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const EMPTY_FRAME = { version: 5, fps: 30, width: 1920, height: 1080, durationInFrames: 150, background: 'brand', still: { frame: 0 }, tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [] }], comps: {}, assets: [] };

type Clip = { component: string; props: Record<string, unknown> };

async function shoot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/figC-${name}.png` });
  }
}

async function elements(admin: SupabaseClient, canvasId: string) {
  const { data } = await admin.from('nodes').select('id, data').eq('canvas_id', canvasId).is('deleted_at', null);
  return data ?? [];
}

async function clipsOf(admin: SupabaseClient, nodeId: string): Promise<Clip[]> {
  const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1);
  return (data?.[0]?.doc as { tracks: { clips: Clip[] }[] } | undefined)?.tracks.flatMap((t) => t.clips) ?? [];
}

async function allClips(admin: SupabaseClient, canvasId: string): Promise<Clip[]> {
  const found = await elements(admin, canvasId);
  return (await Promise.all(found.map((e) => clipsOf(admin, e.id)))).flat();
}

async function putOnClipboard(page: Page, entries: Record<string, string>) {
  await page.evaluate(async (items) => {
    const blobs = Object.fromEntries(Object.entries(items).map(([type, body]) => [type, new Blob([body], { type })]));
    await navigator.clipboard.write([new ClipboardItem(blobs)]);
  }, entries);
}

async function pasteOverCanvas(page: Page) {
  const pane = (await page.locator('.svelte-flow').boundingBox())!;
  await page.mouse.move(pane.x + pane.width * 0.5, pane.y + pane.height * 0.5);
  await page.mouse.click(pane.x + pane.width * 0.5, pane.y + pane.height * 0.5);
  await page.keyboard.press('ControlOrMeta+v');
}

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test.describe('system clipboard on the canvas @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('an svg pasted from another app lands as vector shapes with their colours', async ({ page, session, admin }) => {
    test.setTimeout(120_000);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await putOnClipboard(page, { 'text/plain': ICON });
    await pasteOverCanvas(page);

    await expect.poll(async () => (await allClips(admin, session.canvasId)).map((c) => c.props.fill).sort(), { timeout: 20_000 }).toEqual(['#0a84ff', '#ff3b30']);
    await expect.poll(async () => (await elements(admin, session.canvasId)).map((n) => (n.data as { kind?: string }).kind), { timeout: 20_000 }).toEqual(['group']);
    await page.waitForTimeout(3000);
    await shoot(page, '1-svg-pasted');
  });

  test('plain text pasted becomes a text element', async ({ page, session, admin }) => {
    test.setTimeout(120_000);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await putOnClipboard(page, { 'text/plain': 'Pasted from the system clipboard' });
    await pasteOverCanvas(page);

    await expect.poll(async () => (await allClips(admin, session.canvasId)).map((c) => [c.component, c.props.text]), { timeout: 20_000 }).toEqual([['Text', 'Pasted from the system clipboard']]);
    await page.waitForTimeout(800);
    await shoot(page, '2-text-pasted');
  });

  test('a copied element survives a reload: the payload rides the system clipboard, not page memory', async ({ page, session, admin }) => {
    test.setTimeout(120_000);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await putOnClipboard(page, { 'text/plain': ICON });
    await pasteOverCanvas(page);
    await expect.poll(async () => (await elements(admin, session.canvasId)).map((n) => (n.data as { kind?: string }).kind), { timeout: 20_000 }).toEqual(['group']);
    await page.waitForTimeout(3000);
    const pane = (await page.locator('.svelte-flow').boundingBox())!;
    await page.mouse.click(pane.x + 40, pane.y + pane.height - 160);
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('ControlOrMeta+c');
    const copiedHtml = () => page.evaluate(async () => {
      const [item] = await navigator.clipboard.read();
      return item?.types.includes('text/html') ? (await item.getType('text/html')).text() : (item?.types.join(',') ?? '');
    });
    await expect.poll(copiedHtml, { timeout: 10_000 }).toContain('data-feega-clipboard');

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await pasteOverCanvas(page);
    await expect.poll(async () => (await elements(admin, session.canvasId)).length, { timeout: 20_000 }).toBe(2);
    await page.waitForTimeout(800);
    await shoot(page, '3-copied-across-reload');
  });

  test('a figma clipboard explains how to bring the layers in', async ({ page, session }) => {
    test.setTimeout(60_000);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await putOnClipboard(page, { 'text/html': '<span data-metadata="<!--(figmeta)e30=(/figmeta)-->"></span><span data-buffer="<!--(figma)AAAA(/figma)-->"></span>' });
    await pasteOverCanvas(page);
    await expect(page.getByText(/Copy as SVG/)).toBeVisible({ timeout: 10_000 });
    await shoot(page, '4-figma-hint');
  });

  test('a pasted element asks for a 4x png from its export menu', async ({ page, session, admin }) => {
    test.setTimeout(180_000);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await putOnClipboard(page, { 'text/plain': 'Export me' });
    await pasteOverCanvas(page);
    await expect.poll(async () => (await elements(admin, session.canvasId)).length, { timeout: 20_000 }).toBe(1);
    await page.waitForTimeout(2000);
    await page.mouse.click(10, 10);

    const pane = (await page.locator('.svelte-flow').boundingBox())!;
    await page.mouse.click(pane.x + pane.width * 0.5, pane.y + pane.height * 0.5, { button: 'right' });
    await page.getByRole('menuitem', { name: /Export/ }).click();
    const dialog = page.getByTestId('export-dialog');
    await dialog.getByTestId('export-preset').filter({ hasText: '4×' }).click();
    await expect(dialog.getByTestId('export-row')).toHaveCount(1);
    await shoot(page, '5-export-presets');
    const asked = page.waitForRequest((r) => r.url().includes('exportSelection') && r.method() === 'POST');
    await dialog.getByTestId('export-go').click();
    const body = (await asked).postData() ?? '';
    const rows = JSON.parse(body.match(/name="rows"\r\n\r\n([^\r]*)/)?.[1] ?? '[]');
    expect(rows).toMatchObject([{ format: 'png', by: 'scale', value: 4, suffix: '@4x' }]);
  });

  test('text and svg pasted over a frame land inside it', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const frame = await seedNode({ type: 'motion', x: 0, y: 0, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: EMPTY_FRAME, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await putOnClipboard(page, { 'text/plain': 'Inside the frame' });
    await pasteOverCanvas(page);
    await expect.poll(async () => (await clipsOf(admin, frame.id)).map((c) => c.props.text), { timeout: 20_000 }).toContain('Inside the frame');

    const text = (await clipsOf(admin, frame.id)).find((c) => c.component === 'Text')!;
    expect(text.props).toMatchObject({ sizing: 'auto', color: 'brand.text' });

    await putOnClipboard(page, { 'text/plain': ICON });
    await pasteOverCanvas(page);
    await expect.poll(async () => (await clipsOf(admin, frame.id)).length, { timeout: 30_000 }).toBe(2);
    expect((await elements(admin, session.canvasId)).map((n) => n.id)).toEqual([frame.id]);
    await page.waitForTimeout(2000);
    await shoot(page, '7-pasted-into-frame');
  });

  test('an image pasted over a frame lands inside it, with no node of its own', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const frame = await seedNode({ type: 'motion', x: 0, y: 0, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: EMPTY_FRAME, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const png = readFileSync(new URL('./fixtures/blue-square.png', import.meta.url)).toString('base64');
    await page.evaluate(async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': new Blob([bytes], { type: 'image/png' }) })]);
    }, png);
    await pasteOverCanvas(page);

    await expect.poll(async () => (await clipsOf(admin, frame.id)).map((c) => c.component), { timeout: 30_000 }).toEqual(['Image']);
    expect((await elements(admin, session.canvasId)).map((n) => n.id)).toEqual([frame.id]);
    await page.waitForTimeout(2000);
    await shoot(page, '8-image-into-frame');
  });
});
