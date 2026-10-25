import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.FIG_SHOTS ?? `${homedir()}/Documents/feega-videos/e2e`;
const SETTLE_MS = 2500;
const SCENE_FRAMES = 60;
const FPS = 30;
const FRAME = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const PHOTO = { width: 800, height: 800 };

const LAUNCH = [
  { x: 80, title: 'Meet Orbit', body: 'The desk lamp that follows your day.', button: 'Pre-order', bg: '#0b1b3a', accent: '#3b82f6', photo: { r: 59, g: 130, b: 246 } },
  { x: 2240, title: 'Light that adapts', body: 'Warm at night, bright at noon, automatic.', button: 'See how', bg: '#f4f1ea', accent: '#111111', photo: { r: 245, g: 180, b: 60 } },
  { x: 4400, title: 'Ships in March', body: 'Free delivery for early backers.', button: 'Reserve yours', bg: '#ff5a1f', accent: '#ffffff', photo: { r: 30, g: 30, b: 30 } }
];

type Launch = (typeof LAUNCH)[number];

const solid = (color: string) => [{ type: 'solid', color, opacity: 1, visible: true, blend: 'normal' }];

const clip = (id: string, component: string, props: Record<string, unknown>) => ({ id, component, from: 0, durationInFrames: SCENE_FRAMES, props });

const sceneDoc = (s: Launch, photo: string) => ({
  version: 5,
  fps: FPS,
  width: 1920,
  height: 1080,
  durationInFrames: SCENE_FRAMES,
  background: 'brand',
  still: { frame: 0 },
  tracks: [
    {
      id: 'v1',
      kind: 'visual',
      name: 'Video 1',
      clips: [
        clip('bg', 'Shape', { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1, fills: solid(s.bg) }),
        clip('photo', 'Image', { assetId: photo, fit: 'cover', x: 0.74, y: 0.5, width: 0.36, height: 0.64 }),
        clip('title', 'Text', { text: s.title, size: 0.08, weight: 600, tracking: -0.05, color: s.accent, x: 0.28, y: 0.36, width: 0.5, height: 0.2 }),
        clip('body', 'Text', { text: s.body, size: 0.03, color: s.accent, x: 0.28, y: 0.55, width: 0.44, height: 0.12 }),
        clip('button', 'Shape', { shape: 'rect', roundness: 0.5, x: 0.22, y: 0.72, width: 0.2, height: 0.09, fills: solid(s.accent) }),
        clip('button-label', 'Text', { text: s.button, size: 0.026, weight: 600, color: s.bg, x: 0.22, y: 0.72, width: 0.2, height: 0.08, align: 'center' })
      ]
    }
  ],
  comps: {},
  assets: []
});

async function scrubTo(page: Page, seconds: number) {
  const ruler = page.getByRole('slider', { name: 'Playhead' });
  const box = (await ruler.boundingBox())!;
  const time = page.getByTestId('frame-timeline-time');
  let lo = box.x;
  let hi = box.x + box.width;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    await page.mouse.click(mid, box.y + box.height / 2);
    const at = Number.parseFloat((await time.textContent()) ?? '0');
    if (Math.abs(at - seconds) < 0.1) {
      return;
    }
    if (at < seconds) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
}

test.describe('combined scenes play in their own windows @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');

  test('scrubbing a combined product launch shows each scene in its window', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1600, height: 1000 });
    const ids: string[] = [];
    for (const s of LAUNCH) {
      const png = await sharp({ create: { ...PHOTO, channels: 3, background: s.photo } })
        .composite([{ input: Buffer.from(`<svg width="800" height="800"><circle cx="400" cy="330" r="180" fill="white" opacity="0.85"/><rect x="380" y="500" width="40" height="220" fill="white" opacity="0.7"/></svg>`) }])
        .png()
        .toBuffer();
      const path = `${session.orgId}/${session.projectId}/e2e/${randomUUID()}.png`;
      await admin.storage.from('canvas-assets').upload(path, png, { contentType: 'image/png' });
      const { data: asset } = await admin.from('assets').insert({ org_id: session.orgId, project_id: session.projectId, type: 'image', url: path, mime_type: 'image/png', bytes: png.length, ...PHOTO, source: 'upload' }).select('id').single();
      const frame = await seedNode({ type: 'motion', x: s.x, y: 80, data: FRAME });
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: sceneDoc(s, asset!.id), actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
      ids.push(frame.id);
    }

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const hosts = ids.map((id) => page.locator(`[data-testid="frame-overlays"] [data-frame="${id}"]`));
    await expect(hosts[0]).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press('Shift+Digit1');
    await page.waitForTimeout(SETTLE_MS);
    const boxes = await Promise.all(hosts.map(async (h) => (await h.boundingBox())!));
    const left = Math.min(...boxes.map((b) => b.x)) - 20;
    const top = Math.min(...boxes.map((b) => b.y)) - 30;
    const right = Math.max(...boxes.map((b) => b.x + b.width)) + 20;
    const bottom = Math.max(...boxes.map((b) => b.y + b.height)) + 20;
    await page.mouse.move(left, top);
    await page.mouse.down();
    await page.mouse.move(right, bottom, { steps: 12 });
    await page.mouse.up();
    await page.mouse.click(left + 10, bottom + 40, { button: 'right' });
    await page.getByRole('menuitem', { name: 'Combine into video' }).click();

    const parent = async () => {
      const { data } = await admin.from('nodes').select('id').eq('canvas_id', session.canvasId).eq('type', 'motion').is('deleted_at', null).not('id', 'in', `(${ids.join(',')})`);
      return data?.[0]?.id ?? null;
    };
    await expect.poll(parent, { timeout: 30_000 }).not.toBeNull();
    const parentId = (await parent())!;
    const host = page.locator(`[data-testid="frame-overlays"] [data-frame="${parentId}"]`);
    await expect(host).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press('Escape');
    await page.keyboard.press('Shift+Digit1');
    await page.waitForTimeout(SETTLE_MS * 2);
    await page.screenshot({ path: `${SHOTS}/scenes-scrub-0-canvas.png` });

    const box = (await host.boundingBox())!;
    await expect(async () => {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await expect(page.getByTestId('frame-timeline')).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 25_000 });
    await page.keyboard.press('Shift+Digit2');
    await page.waitForTimeout(SETTLE_MS);

    const shown = (await host.boundingBox())!;
    const cornerOf = async (path?: string) => {
      const shot = await page.screenshot({ ...(path ? { path } : {}), clip: shown });
      const { data } = await sharp(shot).extract({ left: 12, top: 12, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
      return [...data.subarray(0, 3)].join(',');
    };

    const scrubbed: string[] = [];
    for (const [i] of LAUNCH.entries()) {
      await scrubTo(page, ((i + 0.5) * SCENE_FRAMES) / FPS);
      await page.waitForTimeout(SETTLE_MS);
      scrubbed.push(await cornerOf(`${SHOTS}/scenes-scrub-${i + 1}.png`));
      await page.screenshot({ path: `${SHOTS}/scenes-scrub-${i + 1}-full.png` });
    }
    expect(new Set(scrubbed).size, `scrubbed corners: ${scrubbed.join(' | ')}`).toBe(LAUNCH.length);

    await scrubTo(page, 0);
    await page.getByTestId('frame-timeline-play').click();
    const played: string[] = [];
    const deadline = Date.now() + (LAUNCH.length * SCENE_FRAMES * 1000) / FPS;
    while (Date.now() < deadline) {
      const corner = await cornerOf();
      if (!played.includes(corner)) {
        await page.screenshot({ path: `${SHOTS}/scenes-play-${played.filter((c, i) => played.indexOf(c) === i).length + 1}.png`, clip: shown });
      }
      played.push(corner);
      await page.waitForTimeout(150);
    }
    await page.getByTestId('frame-timeline-play').click();
    expect(new Set(played).size, `played corners: ${[...new Set(played)].join(' | ')}`).toBeGreaterThanOrEqual(LAUNCH.length);
  });
});
