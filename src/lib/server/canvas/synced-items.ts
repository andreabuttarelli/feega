import type { Db } from '$lib/server/db/client';
import type { CanvasNodeRecord } from '$lib/server/repos/canvas';
import { listNodeSocialPosts } from '$lib/server/repos/social-posts';
import { socialPostItem, type PostRow, type SelectableItem } from '$lib/canvas/select-sources';
import { outputValues, sourceOutputValues, type CustomOutput, type OutputValue } from '$lib/canvas/select-outputs';
import { feedFiltersOf, filterPosts } from '$lib/canvas/source-filters';

export type SyncedRows = { type: 'social_account_feed'; rows: PostRow[] };

export async function syncedSourceRows(db: Db, orgId: string, source: CanvasNodeRecord): Promise<SyncedRows> {
  const posts = await listNodeSocialPosts(db, { orgId, nodeId: source.id });
  return { type: 'social_account_feed', rows: filterPosts(posts, feedFiltersOf(source.data.filters)) };
}

export function itemsOf(synced: SyncedRows): SelectableItem[] {
  return synced.rows.map(socialPostItem);
}

export async function syncedSourceItems(db: Db, orgId: string, source: CanvasNodeRecord): Promise<SelectableItem[]> {
  return itemsOf(await syncedSourceRows(db, orgId, source));
}

export function outputsAt(synced: SyncedRows, index: number, custom: readonly CustomOutput[]): Record<string, OutputValue> {
  if (index < 1 || index > synced.rows.length) {
    return {};
  }
  return outputValues('social_account_feed', synced.rows[index - 1], custom);
}

export function sourceOutputsOf(synced: SyncedRows): Record<string, OutputValue> {
  return sourceOutputValues('social_account_feed', synced.rows);
}
