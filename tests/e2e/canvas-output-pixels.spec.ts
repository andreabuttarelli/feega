import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import type { Locator, Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.CANVAS_MOTION_SHOTS;
const RED = { r: 230, g: 20, b: 20 };
const SIZE = { width: 400, height: 300 };

async function redPng(size: { width: number; height: number }): Promise<Buffer> {
  return sharp({ create: { ...size, channels: 3, background: RED } }).png().toBuffer();
}

async function centrePixel(page: Page, target: Locator): Promise<{ r: number; g: number; b: number }> {
  const box = (await target.boundingBox())!;
  const shot = await page.screenshot({ clip: { x: box.x + box.width * 0.3 - 5, y: box.y + box.height * 0.3 - 5, width: 10, height: 10 } });
  const { data } = await sharp(shot).resize(1, 1).raw().toBuffer({ resolveWithObject: true });
  return { r: data[0], g: data[1], b: data[2] };
}

const isRed = (p: { r: number; g: number; b: number }) => p.r > 180 && p.g < 90 && p.b < 90;

test.use({ video: process.env.E2E_VIDEO ? 'on' : 'off' });

test.describe('a generated output placed on the canvas shows what was generated @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  for (const size of [SIZE, { width: 1, height: 1 }]) {
  test(`a red ${size.width}×${size.height} image becomes a red free element, closed and opened`, async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const png = await redPng(size);
    const path = `${session.orgId}/${session.projectId}/e2e/${randomUUID()}.png`;
    await admin.storage.from('canvas-assets').upload(path, png, { contentType: 'image/png' });
    const { data: asset } = await admin.from('assets').insert({ org_id: session.orgId, project_id: session.projectId, type: 'image', url: path, mime_type: 'image/png', bytes: png.length, ...size, source: 'upload' }).select('id').single();
    const gen = await seedNode({ type: 'image', x: 80, y: 420, data: { prompt: 'red', refId: asset!.id } });

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.locator(`[data-id="${gen.id}"] .gen-body`).hover();
    const viewport = page.viewportSize()!;
    await page.getByTestId('drag-to-frame').dragTo(page.locator('.svelte-flow__pane'), { targetPosition: { x: viewport.width / 2, y: 160 } });

    const made = async () => (await admin.from('nodes').select('id').eq('canvas_id', session.canvasId).eq('type', 'motion').is('deleted_at', null)).data ?? [];
    await expect.poll(async () => (await made()).length, { timeout: 10_000 }).toBe(1);
    const element = page.locator(`[data-motion-node="${(await made())[0].id}"] [data-frame-stage]`);
    await admin.from('nodes').update({ deleted_at: new Date().toISOString() }).eq('id', gen.id);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(element).toBeVisible();
    const elementId = (await made())[0].id;
    expect(await page.evaluate((id) => { const r = document.querySelector(`[data-motion-node="${id}"]`)!.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('[data-motion-node]')?.getAttribute('data-motion-node'); }, elementId), 'nothing covers the element').toBe(elementId);

    await expect.poll(async () => isRed(await centrePixel(page, element)), { timeout: 20_000, message: 'closed, the element shows the red picture' }).toBe(true);
    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/red-closed-${size.width}.png` });
    }

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect.poll(async () => isRed(await centrePixel(page, element)), { timeout: 20_000, message: 'after a reload, the poster is red too' }).toBe(true);

    await element.click();
    await expect(page.getByTestId('motion-editor')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(3000);
    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/red-opening-${size.width}.png` });
    }
    await expect.poll(async () => isRed(await centrePixel(page, element)), { timeout: 20_000, message: 'opened, the element shows the red picture' }).toBe(true);
    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/red-opened-${size.width}.png` });
    }
  });
  }

  test('a red video becomes a red free element', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const out = join(mkdtempSync(join(tmpdir(), 'red-')), 'red.mp4');
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0xE61414:s=320x240:d=1', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', out]);
    const mp4 = readFileSync(out);
    const path = `${session.orgId}/${session.projectId}/e2e/${randomUUID()}.mp4`;
    await admin.storage.from('canvas-assets').upload(path, mp4, { contentType: 'video/mp4' });
    const { data: asset } = await admin.from('assets').insert({ org_id: session.orgId, project_id: session.projectId, type: 'video', url: path, mime_type: 'video/mp4', bytes: mp4.length, width: 320, height: 240, duration_s: 1, source: 'upload' }).select('id').single();
    const gen = await seedNode({ type: 'video', x: 80, y: 420, data: { prompt: 'red', refId: asset!.id } });

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.locator(`[data-id="${gen.id}"] .gen-body`).hover();
    await page.getByTestId('drag-to-frame').dragTo(page.locator('.svelte-flow__pane'), { targetPosition: { x: page.viewportSize()!.width / 2, y: 160 } });
    const made = async () => (await admin.from('nodes').select('id').eq('canvas_id', session.canvasId).eq('type', 'motion').is('deleted_at', null)).data ?? [];
    await expect.poll(async () => (await made()).length, { timeout: 10_000 }).toBe(1);
    await admin.from('nodes').update({ deleted_at: new Date().toISOString() }).eq('id', gen.id);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const element = page.locator(`[data-motion-node="${(await made())[0].id}"] [data-frame-stage]`);
    await expect.poll(async () => isRed(await centrePixel(page, element)), { timeout: 30_000, message: 'the video element shows the red video' }).toBe(true);
  });

  test('a generated text becomes a free text element that shows the text', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const { data: asset } = await admin.from('assets').insert({ org_id: session.orgId, project_id: session.projectId, type: 'text', url: `${session.orgId}/${session.projectId}/e2e/${randomUUID()}.txt`, mime_type: 'text/plain', bytes: 5, content: 'HELLO', source: 'upload' }).select('id').single();
    const gen = await seedNode({ type: 'text', x: 80, y: 420, data: { prompt: 'hello', refId: asset!.id } });
    const made = async () => (await admin.from('nodes').select('id').eq('canvas_id', session.canvasId).eq('type', 'motion').is('deleted_at', null)).data ?? [];

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const moved = await page.evaluate(async ([src, x, y]) => {
      const body = new FormData();
      body.set('source', src);
      body.set('drop', JSON.stringify({ on: 'canvas', x, y }));
      return (await fetch(`${location.pathname}?/placeOutput`, { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } })).status;
    }, [gen.id, 900, 100] as const);
    expect(moved).toBe(200);
    await expect.poll(async () => (await made()).length, { timeout: 10_000 }).toBe(1);
    await admin.from('nodes').update({ deleted_at: new Date().toISOString() }).eq('id', gen.id);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const element = page.locator(`[data-motion-node="${(await made())[0].id}"] [data-frame-stage]`);
    await expect.poll(async () => {
      const shot = await element.screenshot();
      const { data } = await sharp(shot).greyscale().raw().toBuffer({ resolveWithObject: true });
      return Math.max(...data) - Math.min(...data);
    }, { timeout: 30_000, message: 'closed, the text element draws its letters' }).toBeGreaterThan(80);

    await element.click();
    await expect(page.getByTestId('motion-editor')).toBeVisible({ timeout: 15_000 });
    const corner = async () => {
      const box = (await element.boundingBox())!;
      const shot = await page.screenshot({ clip: { x: box.x + 4, y: box.y + 4, width: 6, height: 6 } });
      const { data } = await sharp(shot).resize(1, 1).raw().toBuffer({ resolveWithObject: true });
      return data[0] + data[1] + data[2];
    };
    await page.waitForTimeout(3000);
    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/text-opened.png` });
    }
    await expect.poll(corner, { timeout: 20_000, message: 'opened, what the element does not cover shows the canvas, not black' }).toBeGreaterThan(300);
  });
});
