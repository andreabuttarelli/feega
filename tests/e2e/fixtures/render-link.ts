import { createHash, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { E2eSession } from './session';

const OPEN_MS = 30 * 60_000;
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
export const RENDER_BUCKET = 'canvas-assets';

type Seed = (seed: { type: string; x?: number; y?: number; data: Record<string, unknown> }) => Promise<{ id: string }>;

export async function seedMotion(admin: SupabaseClient, session: E2eSession, seedNode: Seed, doc: unknown): Promise<string> {
  const node = await seedNode({ type: 'motion', x: 80, y: 80, data: LANDSCAPE });
  const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
  expect(error).toBeNull();
  return node.id;
}

export async function mintRenderLink(admin: SupabaseClient, session: E2eSession, nodeId: string): Promise<{ runId: string; url: string }> {
  const secret = randomBytes(32).toString('base64url');
  const params = { kind: 'browser-render', revision: 1, link: { hash: createHash('sha256').update(secret).digest('hex'), expiresAt: new Date(Date.now() + OPEN_MS).toISOString(), claim: null }, actor: { kind: 'agent', id: session.userId, agentKey: 'mcp' } };
  const { data, error } = await admin
    .from('node_runs')
    .insert({ org_id: session.orgId, node_id: nodeId, prompt: 'e2e', model: 'browser', params, status: 'running', external_job_id: 'browser-render:1', actor_kind: 'agent', actor_id: session.userId })
    .select('id')
    .single();
  expect(error).toBeNull();
  return { runId: data!.id, url: `/render/${data!.id}.${secret}` };
}

export async function renderedAsset(admin: SupabaseClient, runId: string): Promise<{ url: string; bytes: number }> {
  const { data: run } = await admin.from('node_runs').select('status, output_asset_id').eq('id', runId).single();
  expect(run).toMatchObject({ status: 'done' });
  const { data: asset } = await admin.from('assets').select('url, mime_type, bytes').eq('id', run!.output_asset_id!).single();
  expect(asset).toMatchObject({ mime_type: 'video/mp4' });
  return { url: asset!.url!, bytes: Number(asset!.bytes) };
}

export async function renderOnPage(page: Page, timeoutMs: number): Promise<number> {
  await expect(page.getByTestId('render-start')).toBeVisible({ timeout: 20_000 });
  const t0 = Date.now();
  await page.getByTestId('render-start').click();
  await expect(page.getByTestId('render-saved')).toBeVisible({ timeout: timeoutMs });
  return Date.now() - t0;
}
