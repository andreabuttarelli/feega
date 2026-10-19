import sharp from 'sharp';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';

const FONT_FILE = 'static/fonts/fraunces-latin.woff2';
const SQUARE = { format: '1:1', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const PROBE = 32;
const MIN_GLYPH_DIFF = 6;
const EXPORT_MS = 120_000;
const SERVER_EXPORT = process.env.E2E_SERVER_EXPORT === '1';

const frameDoc = {
  version: 5,
  fps: 30,
  width: 1080,
  height: 1080,
  durationInFrames: 60,
  background: 'brand',
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 't', from: 0, durationInFrames: 60, component: 'Text', props: { text: 'Rag wQ', size: 0.2, x: 0.5, y: 0.5, width: 0.9, height: 0.4, color: '#ffffff', font: 'sans' } }] }],
  comps: {},
  assets: []
};

async function seedFrame(session: { orgId: string; userId: string }, admin: SupabaseClient, seedNode: (s: { type: string; x: number; y: number; data: object }) => Promise<{ id: string }>, x: number) {
  const frame = await seedNode({ type: 'motion', x, y: 80, data: SQUARE });
  const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: frameDoc, actor_kind: 'user', actor_id: session.userId });
  expect(error).toBeNull();
  return frame.id;
}

async function selectText(page: Page) {
  await page.locator('[data-clip-id="t"]').first().click();
  await page.getByRole('tab', { name: 'Properties', exact: true }).click();
}

async function previewGlyphs(page: Page): Promise<Buffer> {
  const text = page.getByRole('region', { name: 'Preview' }).frameLocator('iframe').getByText('Rag wQ');
  await expect(text).toBeVisible();
  await expect.poll(() => text.evaluate(() => document.fonts.status)).toBe('loaded');
  const png = await text.evaluate((el) => {
    const style = getComputedStyle(el);
    const canvas = Object.assign(document.createElement('canvas'), { width: 1400, height: 300 });
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    ctx.fillText(el.textContent ?? '', 10, 240);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  return Buffer.from(png, 'base64');
}

async function exportText(page: Page, canvasPath: string, frameId: string): Promise<Buffer> {
  const answer = await page.request.post(`${canvasPath}?/exportSelection`, {
    headers: { 'x-sveltekit-action': 'true', origin: new URL(page.url()).origin },
    timeout: EXPORT_MS,
    multipart: { elements: JSON.stringify([{ frameId, elementId: 't' }]), rows: JSON.stringify([{ format: 'png', by: 'scale', value: 1 }]) }
  });
  const body = JSON.parse(await answer.text()) as { type: string; data: string };
  expect(body.type, body.data).toBe('success');
  const url = (JSON.parse(body.data) as string[]).find((v) => typeof v === 'string' && v.startsWith('http'))!;
  return Buffer.from(await (await page.request.get(url, { timeout: EXPORT_MS })).body());
}

const probe = (png: Buffer) => sharp(png).flatten({ background: '#ffffff' }).grayscale().resize(PROBE * 4, PROBE, { fit: 'fill' }).raw().toBuffer();

async function glyphDiff(a: Buffer, b: Buffer): Promise<number> {
  const [x, y] = await Promise.all([probe(a), probe(b)]);
  return x.reduce((sum, v, i) => sum + Math.abs(v - y[i]), 0) / x.length;
}

async function orgFonts(admin: SupabaseClient, orgId: string): Promise<{ id: string; url: string }[]> {
  const { data } = await admin.from('assets').select('id, url').eq('org_id', orgId).is('project_id', null).like('url', `${orgId}/fonts/%`);
  return (data ?? []) as { id: string; url: string }[];
}

async function dropFontsAddedSince(admin: SupabaseClient, orgId: string, before: Set<string>) {
  const rows = (await orgFonts(admin, orgId)).filter((r) => !before.has(r.id));
  if (!rows.length) {
    return;
  }
  await admin.storage.from('canvas-assets').remove(rows.map((r) => r.url));
  await admin.from('assets').delete().in('id', rows.map((r) => r.id));
}

test.use({ viewport: { width: 1280, height: 860 }, actionTimeout: 15_000 });

test.describe('custom fonts @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack reale: E2E_REAL_STACK=1');

  test('an uploaded font reaches the text, survives a reload and changes the drawn glyphs', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(240_000);
    const fontFrame = await seedFrame(session, admin, seedNode, 80);
    const fallbackFrame = await seedFrame(session, admin, seedNode, 1400);
    const canvasPath = `/p/${session.projectId}/c/${session.canvasId}`;
    const editorPath = `${canvasPath}/motion/${fontFrame}`;
    const before = new Set((await orgFonts(admin, session.orgId)).map((r) => r.id));

    try {
      await gotoHydrated(page, editorPath);
      await selectText(page);
      await page.getByRole('button', { name: 'Font sans' }).click();
      await page.getByLabel('Upload a font file').setInputFiles(FONT_FILE);
      await expect(page.getByRole('button', { name: 'Font Fraunces' })).toBeVisible({ timeout: 30_000 });

      await expect
        .poll(async () => {
          const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', fontFrame).order('version', { ascending: false }).limit(1).single();
          return JSON.stringify(data?.doc ?? {});
        }, { timeout: 30_000 })
        .toContain('"font":"Fraunces"');

      await page.reload();
      await selectText(page);
      await expect(page.getByRole('button', { name: 'Font Fraunces' })).toBeVisible();
      await expect(page.getByTestId('fonts-missing')).toHaveCount(0);
      await page.getByRole('button', { name: 'Font Fraunces' }).click();
      await expect(page.getByTestId('font-uploaded')).toContainText('Fraunces');

      await page.keyboard.press('Escape');
      const previewWithFont = await previewGlyphs(page);
      await gotoHydrated(page, `${canvasPath}/motion/${fallbackFrame}`);
      const previewFallback = await previewGlyphs(page);
      expect(await glyphDiff(previewWithFont, previewFallback), 'the preview draws Fraunces, not the fallback').toBeGreaterThan(MIN_GLYPH_DIFF);

      if (!SERVER_EXPORT) {
        test.info().annotations.push({ type: 'unrun', description: 'PNG export needs the server renderer: E2E_SERVER_EXPORT=1' });
        return;
      }
      const fallback = await exportText(page, canvasPath, fallbackFrame);
      const withFont = await exportText(page, canvasPath, fontFrame);
      expect(await glyphDiff(withFont, fallback), 'the exported PNG draws Fraunces, not the fallback').toBeGreaterThan(MIN_GLYPH_DIFF);
    } finally {
      await dropFontsAddedSince(admin, session.orgId, before);
    }
  });
});
