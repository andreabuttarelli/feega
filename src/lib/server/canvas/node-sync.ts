import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { DataCheck, findNode, patchNodeData, writeNodeData, type PatchWrite } from '$lib/server/repos/canvas';
import { productsOf, socialFeedOf } from '$lib/canvas-node-data';
import { normalizeUrl } from '$lib/ads-fee';
import { normalizeHandle } from '$lib/canvas/source-filters';
import { isProductPlatform } from '$lib/canvas/products-node';
import { isSocialFeedPlatform } from '$lib/canvas/social-feed-node';
import { syncProductsNode } from './products-sync';
import { syncSocialFeedNode, syncSocialFeedEntries } from './social-feed-sync';

type SyncNodeOutcome = { ok: true; synced: number; extra?: Record<string, unknown> } | { ok: false; error: string };

type SyncedNode = { id: string; data: Record<string, unknown> };

async function syncProducts(db: Db, orgId: string, projectId: string | null, node: SyncedNode): Promise<SyncNodeOutcome> {
  const parsed = productsOf({ id: node.id, type: 'products', data: node.data });
  const storeUrl = normalizeUrl(parsed?.url);
  if (!parsed || !isProductPlatform(parsed.platform) || !storeUrl) {
    return { ok: false, error: 'invalid_url: this node has no store URL to sync' };
  }

  const outcome = await syncProductsNode(db, {
    orgId,
    projectId,
    nodeId: node.id,
    platform: parsed.platform,
    storeUrl,
    limit: parsed.limit,
    onlyFirstPhoto: parsed.onlyFirstPhoto,
    category: parsed.category
  });

  return outcome.ok ? { ok: true, synced: outcome.synced, extra: { sync_summary: outcome.summary } } : outcome;
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  x: 'X',
  threads: 'Threads',
  facebook: 'Facebook',
  youtube: 'YouTube',
  linkedin: 'LinkedIn'
};

async function syncSocialFeed(db: Db, orgId: string, projectId: string | null, node: SyncedNode): Promise<SyncNodeOutcome> {
  const parsed = socialFeedOf({ id: node.id, type: 'social_account_feed', data: node.data });
  const raw = (parsed?.handle ?? '').trim();
  if (!parsed || !raw) {
    return { ok: false, error: 'missing_handle: this node has no handle to sync' };
  }

  const looksLikeUrlOrMultiline = raw.includes('/') || raw.includes('\n') || raw.includes(',') || raw.startsWith('#');
  if (!looksLikeUrlOrMultiline) {
    const handle = normalizeHandle(raw);
    if (!isSocialFeedPlatform(parsed.platform) || !handle) {
      return { ok: false, error: 'missing_handle: this node has no handle to sync' };
    }
    return syncSocialFeedNode(db, { orgId, projectId, nodeId: node.id, platform: parsed.platform, handle, limit: parsed.limit });
  }

  const outcome = await syncSocialFeedEntries(db, { orgId, projectId, nodeId: node.id, raw, limit: parsed.limit });
  if (!outcome.ok) {
    return outcome;
  }

  const summary = outcome.entries
    .map((e) => `${PLATFORM_LABELS[e.platform] ?? e.platform} · ${e.kind} · ${e.synced}`)
    .concat(outcome.unsupported.map((u) => `${u.source}: ${u.message}`))
    .join(' — ');

  return { ok: true, synced: outcome.synced, extra: { sync_summary: summary } };
}

const SYNC_OF: Record<string, (db: Db, orgId: string, projectId: string | null, node: SyncedNode) => Promise<SyncNodeOutcome>> = {
  products: syncProducts,
  social_account_feed: syncSocialFeed
};

export type NodeSync = PatchWrite | { outcome: 'not_syncable' };

export async function syncNode(db: Db, input: { orgId: string; projectId: string | null; nodeId: string; version: number; actor: Actor }): Promise<NodeSync> {
  const node = await findNode(db, { orgId: input.orgId, nodeId: input.nodeId });
  const sync = node ? SYNC_OF[node.type] : undefined;
  if (!node || !sync) {
    return { outcome: 'not_syncable' };
  }

  const running = await writeNodeData(db, {
    orgId: input.orgId,
    nodeId: input.nodeId,
    expectedVersion: input.version,
    data: { ...node.data, sync_status: 'running', sync_error: null },
    actor: input.actor
  });
  if (running.outcome === 'conflict') {
    return { outcome: 'conflict', keys: [] };
  }

  const outcome = await sync(db, input.orgId, input.projectId, node);
  const patch = outcome.ok
    ? { sync_status: 'done', sync_error: null, synced_count: outcome.synced, synced_at: new Date().toISOString(), ...outcome.extra }
    : { sync_status: 'failed', sync_error: outcome.error };

  return patchNodeData(db, { orgId: input.orgId, nodeId: input.nodeId, patch, check: DataCheck.None, actor: input.actor });
}
