import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { asset, frameHost, openCanvas, seedFrame, solid } from './seed';

const SCENE_FRAMES = 60;
const PLAY_MS = 6500;

const LAUNCH = [
  { x: 80, title: 'Meet Orbit', body: 'The desk lamp that follows your day.', button: 'Pre-order', bg: '#0b1b3a', accent: '#3b82f6', ink: '#ffffff', photo: '/templates/product-3d.webp' },
  { x: 2240, title: 'Light that adapts', body: 'Warm at night, bright at noon, automatic.', button: 'See how', bg: '#f4f1ea', accent: '#111111', ink: '#f4f1ea', photo: '/templates/product-lifestyle.webp' },
  { x: 4400, title: 'Ships in March', body: 'Free delivery for early backers.', button: 'Reserve yours', bg: '#ff5a1f', accent: '#ffffff', ink: '#ff5a1f', photo: '/templates/product-teaser.webp' }
];

type Launch = (typeof LAUNCH)[number];

const clip = (id: string, component: string, props: Record<string, unknown>) => ({ id, component, from: 0, durationInFrames: SCENE_FRAMES, props });

const sceneDoc = (s: Launch) => ({
  version: 5,
  fps: 30,
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
        clip('photo', 'Shape', { shape: 'rect', x: 0.74, y: 0.5, width: 0.36, height: 0.64, fills: [{ type: 'image', src: asset(s.photo), fit: 'cover' }] }),
        clip('title', 'Text', { text: s.title, size: 0.08, weight: 600, tracking: -0.05, color: s.accent === '#111111' ? '#111111' : '#ffffff', x: 0.28, y: 0.36, width: 0.5, height: 0.2 }),
        clip('body', 'Text', { text: s.body, size: 0.03, color: s.accent === '#111111' ? '#333333' : '#ffffff', x: 0.28, y: 0.55, width: 0.44, height: 0.12 }),
        clip('button', 'Shape', { shape: 'rect', roundness: 0.5, x: 0.22, y: 0.72, width: 0.2, height: 0.09, fills: solid(s.accent) }),
        clip('button-label', 'Text', { text: s.button, size: 0.026, weight: 600, color: s.ink, x: 0.22, y: 0.72, width: 0.2, height: 0.08, align: 'center' })
      ]
    }
  ],
  comps: {},
  assets: []
});

test('combine scenes into one video', async ({ page, session, admin, seedNode }) => {
  const ids: string[] = [];
  for (const s of LAUNCH) {
    ids.push(await seedFrame(seedNode, admin, session, { x: s.x, y: 80 }, sceneDoc(s)));
  }
  await installCursor(page);
  await openCanvas(page, session);
  await page.keyboard.press('Shift+Digit1');
  await page.waitForTimeout(2500);
  const boxes = await Promise.all(ids.map(async (id) => (await frameHost(page, id).boundingBox())!));
  const left = Math.min(...boxes.map((b) => b.x)) - 24;
  const top = Math.min(...boxes.map((b) => b.y)) - 36;
  const right = Math.max(...boxes.map((b) => b.x + b.width)) + 24;
  const bottom = Math.max(...boxes.map((b) => b.y + b.height)) + 24;

  await recordDemo(page, { slug: 'combine-scenes', title: 'combine scenes into one video' }, async (d) => {
    await d.drag({ x: left, y: top }, { x: right, y: bottom });
    await d.click({ x: (left + right) / 2, y: bottom + 30 }, { button: 'right' });
    await d.click(page.getByRole('menuitem', { name: 'Combine into video' }));
    await expect.poll(async () => page.locator('[data-testid="frame-overlays"] [data-frame]').count(), { timeout: 30_000 }).toBe(4);
    await d.wait(1200);
    await d.key('Shift+Digit1', '⇧ 1');
    await d.wait(1500);
    const parentId = await page.locator('[data-testid="frame-overlays"] [data-frame]').evaluateAll((els, seeded) => els.map((e) => e.getAttribute('data-frame')).find((id) => !seeded.includes(id!)), ids);
    const parent = frameHost(page, parentId!);
    const small = (await parent.boundingBox())!;
    await d.click({ x: small.x + small.width / 2, y: small.y + small.height / 2 });
    await expect(page.getByTestId('frame-timeline')).toBeVisible({ timeout: 15_000 });
    await d.key('Shift+Digit2', '⇧ 2');
    await d.wait(1200);
    const box = (await parent.boundingBox())!;
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await d.click(page.getByTestId('frame-timeline-play'));
    await d.move({ x: box.x + box.width + 40, y: centre.y });
    await d.look({ x: box.x, y: box.y, width: box.width, height: box.height }, PLAY_MS);
  });
});
