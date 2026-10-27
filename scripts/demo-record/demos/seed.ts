import type { SupabaseClient } from '@supabase/supabase-js';
import type { Page } from '@playwright/test';
import { expect, gotoHydrated, type E2eSession } from '../../../tests/e2e/fixtures/session';

export const FRAME_DATA = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
export const SETTLE_MS = 2500;

type Clip = Record<string, unknown>;
type SeedNode = (seed: { type: string; x?: number; y?: number; data?: Record<string, unknown> }) => Promise<{ id: string }>;

export const frameDoc = (clips: Clip[], extra: Record<string, unknown> = {}, frames = 150) => ({
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: frames,
  background: 'brand',
  still: { frame: 0 },
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips }],
  comps: {},
  assets: [],
  ...extra
});

export const solid = (color: string) => [{ type: 'solid', color, opacity: 1, visible: true, blend: 'normal' }];

export async function seedFrame(seedNode: SeedNode, admin: SupabaseClient, session: E2eSession, at: { x: number; y: number }, doc: object): Promise<string> {
  const frame = await seedNode({ type: 'motion', x: at.x, y: at.y, data: FRAME_DATA });
  const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
  expect(error).toBeNull();
  return frame.id;
}

export const PACK_GAP = 60;

type Cell = { w: number; h: number };

export const FRAME_CELL: Cell = { w: 420, h: 236 };
export const TEXT_CELL: Cell = { w: 360, h: 220 };

export async function packGrid(admin: SupabaseClient, ids: string[], cell: Cell, columns = ids.length, gap = PACK_GAP): Promise<void> {
  for (const [i, id] of ids.entries()) {
    const at = { x: (i % columns) * (cell.w + gap), y: Math.floor(i / columns) * (cell.h + gap) };
    const { error } = await admin.from('nodes').update(at).eq('id', id);
    expect(error).toBeNull();
  }
}

export async function openCanvas(page: Page, session: E2eSession, query = ''): Promise<void> {
  await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}${query}`);
  await expect(page.locator('[data-canvas-surface]')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(SETTLE_MS);
  await page.keyboard.press('Shift+Digit1');
  await page.waitForTimeout(SETTLE_MS);
}

const W = 1920;
const H = 1080;
const SPAN = 150;

type Box = { x: number; y: number; w: number; h: number };

export const asset = (path: string) => `${process.env.E2E_BASE_URL ?? 'http://localhost:5173'}${path}`;

const frac = (b: Box) => ({ x: (b.x + b.w / 2) / W, y: (b.y + b.h / 2) / H, width: b.w / W, height: b.h / H });
const block = (id: string, b: Box, color: string, from = 0) => ({ id, from, durationInFrames: SPAN - from, component: 'Shape', props: { shape: 'rect', ...frac(b), fills: solid(color) } });
const words = (id: string, text: string, b: Box, px: number, color: string, from = 0) => ({ id, from, durationInFrames: SPAN - from, component: 'Text', props: { text, size: px / H, ...frac(b), color, font: 'sans' } });
const picture = (id: string, src: string, b: Box) => ({ id, from: 0, durationInFrames: SPAN, component: 'Shape', props: { shape: 'rect', ...frac(b), fills: [{ type: 'image', src, fit: 'cover' }] } });

export const HERO_PHOTO = { x: 1000, y: 180, w: 820, h: 600 };

export function heroDoc(ctaFrom = 0) {
  return frameDoc([
    block('page', { x: 0, y: 0, w: W, h: H }, '#f6f1ea'),
    words('logo', 'Lumen Ceramics', { x: 96, y: 56, w: 360, h: 40 }, 30, '#1d1a16'),
    words('nav', 'Shop    Journal    Stockists', { x: 1180, y: 60, w: 640, h: 32 }, 22, '#5b544b'),
    words('title', 'Mornings, made slower.', { x: 96, y: 300, w: 820, h: 200 }, 96, '#1d1a16'),
    words('sub', 'Stoneware mugs glazed by hand in Porto. Dishwasher safe, made to last.', { x: 96, y: 520, w: 720, h: 80 }, 28, '#5b544b'),
    block('cta', { x: 96, y: 650, w: 300, h: 76 }, '#1d1a16', ctaFrom),
    words('cta-label', 'Shop the set · €48', { x: 116, y: 668, w: 260, h: 40 }, 24, '#ffffff', ctaFrom),
    picture('product', asset('/templates/product-lifestyle.webp'), HERO_PHOTO),
    words('press', 'As seen in   Kinfolk   Cereal   Monocle   Wallpaper*', { x: 96, y: 930, w: 1200, h: 40 }, 24, '#8a8177')
  ]);
}

export const frameHost =(page: Page, id: string) => page.locator(`[data-testid="frame-overlays"] [data-frame="${id}"]`);

export const BUY_BUTTON = { x: 0.69, y: 0.74, width: 0.22, height: 0.1 };

const buyButton = (state: string, label: string, color: string) => ({
  name: 'Buy button',
  durationInFrames: SPAN,
  component: { name: 'Buy button', set: 'main', variant: { State: state } },
  tracks: [
    {
      id: 'v1',
      kind: 'visual',
      name: 'Video 1',
      clips: [
        { id: 'pill', component: 'Shape', from: 0, durationInFrames: SPAN, props: { shape: 'rect', roundness: 0.5, ...BUY_BUTTON, fills: solid(color) } },
        { id: 'label', component: 'Text', from: 0, durationInFrames: SPAN, props: { text: label, size: 0.032, weight: 600, color: '#ffffff', font: 'sans', align: 'center', ...BUY_BUTTON } }
      ]
    }
  ]
});

export function productCardDoc() {
  return frameDoc(
    [
      block('page', { x: 0, y: 0, w: W, h: H }, '#f6f1ea'),
      picture('mug', asset('/templates/product-lifestyle.webp'), { x: 96, y: 96, w: 840, h: 888 }),
      words('maker', 'Lumen Ceramics', { x: 1060, y: 250, w: 720, h: 40 }, 28, '#8a8177'),
      words('name', 'Morning Mug', { x: 1060, y: 310, w: 760, h: 120 }, 92, '#1d1a16'),
      words('about', 'Stoneware, glazed by hand in Porto. 350 ml.', { x: 1060, y: 450, w: 720, h: 80 }, 30, '#5b544b'),
      words('price', '€24', { x: 1060, y: 580, w: 300, h: 80 }, 56, '#1d1a16'),
      { id: 'buy', component: 'Precomp', from: 0, durationInFrames: SPAN, props: { comp: 'main' } }
    ],
    { comps: { main: buyButton('Default', 'Add to cart', '#1d1a16'), hover: buyButton('Hover', 'Add to cart →', '#4a3f35'), done: buyButton('Done', 'Added ✓', '#2f7d4f') } }
  );
}

const SCENE_FRAMES = 60;

export const LAUNCH = [
  { x: 80, title: 'Meet Orbit', body: 'The desk lamp that follows your day.', button: 'Pre-order', bg: '#0b1b3a', accent: '#3b82f6', ink: '#ffffff', photo: '/templates/product-3d.webp' },
  { x: 2240, title: 'Light that adapts', body: 'Warm at night, bright at noon, automatic.', button: 'See how', bg: '#f4f1ea', accent: '#111111', ink: '#f4f1ea', photo: '/templates/product-lifestyle.webp' },
  { x: 4400, title: 'Ships in March', body: 'Free delivery for early backers.', button: 'Reserve yours', bg: '#ff5a1f', accent: '#ffffff', ink: '#ff5a1f', photo: '/templates/product-teaser.webp' }
];

type Launch = (typeof LAUNCH)[number];

const sceneClip = (id: string, component: string, props: Record<string, unknown>) => ({ id, component, from: 0, durationInFrames: SCENE_FRAMES, props });

export const launchScene = (s: Launch) => ({
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
        sceneClip('bg', 'Shape', { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1, fills: solid(s.bg) }),
        sceneClip('photo', 'Shape', { shape: 'rect', x: 0.74, y: 0.5, width: 0.36, height: 0.64, fills: [{ type: 'image', src: asset(s.photo), fit: 'cover' }] }),
        sceneClip('title', 'Text', { text: s.title, size: 0.08, weight: 600, tracking: -0.05, color: s.accent === '#111111' ? '#111111' : '#ffffff', x: 0.28, y: 0.36, width: 0.5, height: 0.2 }),
        sceneClip('body', 'Text', { text: s.body, size: 0.03, color: s.accent === '#111111' ? '#333333' : '#ffffff', x: 0.28, y: 0.55, width: 0.44, height: 0.12 }),
        sceneClip('button', 'Shape', { shape: 'rect', roundness: 0.5, x: 0.22, y: 0.72, width: 0.2, height: 0.09, fills: solid(s.accent) }),
        sceneClip('button-label', 'Text', { text: s.button, size: 0.026, weight: 600, color: s.ink, x: 0.22, y: 0.72, width: 0.2, height: 0.08, align: 'center' })
      ]
    }
  ],
  comps: {},
  assets: []
});

