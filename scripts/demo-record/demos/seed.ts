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

export const frameHost = (page: Page, id: string) => page.locator(`[data-testid="frame-overlays"] [data-frame="${id}"]`);
