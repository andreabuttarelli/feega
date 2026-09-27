import { createHash } from 'node:crypto';
import type { Db } from '$lib/server/db/client';
import { fetchSocialFeed } from '$lib/server/social-feed-fetch';
import { upsertNodeSocialPosts } from '$lib/server/repos/social-posts';
import { archiveImageToBucket } from '$lib/server/media-archive';
import type { MediaItem, NormalizedPost } from '$lib/server/scrapecreators';

/**
 * UN GIRO DI SINCRONIZZAZIONE PER UN NODO `social_account_feed`.
 *
 * Stesso patto di `products-sync.ts`: il nodo non appartiene a un brand, prende una piattaforma e
 * un handle e li scarica per conto suo — "prende un handler e scarica quello". Le righe finiscono
 * sotto il proprio `node_id` (`social_posts_node_id_external_id_key`), non su un brand condiviso.
 *
 * OGNI THUMBNAIL È UN URL DI CDN FIRMATO, CHE SCADE — la stessa ragione per cui `scrapecreators.ts`
 * archivia le miniature dello storico di un brand (`archiveHistoryThumbnails`). Qui non c'è un
 * brand da cui derivare un `ownerId`: il nodo scarica per conto proprio, quindi il posto giusto è
 * `canvas-assets`, la stessa convenzione già usata dagli upload della tela
 * (`${orgId}/${projectId}/...`, `asset-storage.ts`) — un nodo senza progetto usa il proprio id al
 * suo posto, così la chiave resta sempre scritta.
 */
export type SocialFeedSyncOutcome =
  | { ok: true; synced: number }
  | { ok: false; error: string };

export type ArchivedItem = MediaItem & { thumbnailPath?: string };
export type ArchivedPost = Omit<NormalizedPost, 'items'> & { items?: ArchivedItem[] };

const CANVAS_ASSET_BUCKET = 'canvas-assets';

async function archiveItem(db: Db, orgId: string, nodeId: string, item: MediaItem): Promise<ArchivedItem> {
  if (!item.thumbnailUrl) {
    return item;
  }

  const key = createHash('sha1').update(item.thumbnailUrl).digest('hex').slice(0, 16);
  const path = await archiveImageToBucket(db, `${orgId}/${nodeId}/${key}.jpg`, item.thumbnailUrl, CANVAS_ASSET_BUCKET);
  return path ? { ...item, thumbnailPath: path } : item;
}

async function archivePosts(db: Db, orgId: string, nodeId: string, posts: NormalizedPost[]): Promise<ArchivedPost[]> {
  return Promise.all(
    posts.map(async (post) => {
      if (!post.items?.length) {
        return post;
      }
      const items = await Promise.all(post.items.map((item) => archiveItem(db, orgId, nodeId, item)));
      return { ...post, items };
    })
  );
}

export async function syncSocialFeedNode(
  db: Db,
  input: {
    orgId: string;
    projectId: string | null;
    nodeId: string;
    platform: string;
    handle: string;
    limit: number;
  }
): Promise<SocialFeedSyncOutcome> {
  const fetched = await fetchSocialFeed(input.platform, input.handle, input.limit);
  if (!fetched.ok) {
    return { ok: false, error: fetched.error };
  }

  const posts = await archivePosts(db, input.orgId, input.nodeId, fetched.posts);

  const synced = await upsertNodeSocialPosts(db, {
    orgId: input.orgId,
    projectId: input.projectId,
    nodeId: input.nodeId,
    platform: input.platform,
    handle: input.handle,
    posts
  });

  return { ok: true, synced };
}
