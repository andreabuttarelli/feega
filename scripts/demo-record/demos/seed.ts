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

export async function openCanvas(page: Page, session: E2eSession, query = ''): Promise<void> {
  await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}${query}`);
  await expect(page.locator('[data-canvas-surface]')).toBeVisible({ timeout: 30_000 });
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
