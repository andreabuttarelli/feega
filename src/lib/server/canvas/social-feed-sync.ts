import { createHash } from 'node:crypto';
import type { Db } from '$lib/server/db/client';
import { fetchSocialFeed, fetchClassifiedEntry } from '$lib/server/social-feed-fetch';
import { upsertNodeSocialPosts } from '$lib/server/repos/social-posts';
import { archiveImageToBucket } from '$lib/server/media-archive';
import type { MediaItem, NormalizedPost } from '$lib/server/scrapecreators';
import { classifySocialLines, type SocialEntry, type ClassifyFailureReason } from '$lib/canvas/social-url-classifier';

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

export type SyncedEntry = { platform: string; kind: SocialEntry['kind']; source: string; synced: number };
export type UnsupportedEntry = { source: string; reason: ClassifyFailureReason; message: string };

export type SocialFeedEntriesOutcome =
  | { ok: true; synced: number; entries: SyncedEntry[]; unsupported: UnsupportedEntry[] }
  | { ok: false; error: string };

/**
 * QUEL CHE L'UTENTE HA INCOLLATO — una riga, più righe, handle nudi o URL — classificato una volta
 * (`social-url-classifier.ts`) e sincronizzato entry per entry. Ogni entry finisce sotto il proprio
 * `handle` (il post singolo usa l'id del post come handle, per restare nella stessa colonna che
 * `social_posts_node_id_external_id_key` già indicizza), così un profilo e un post dello stesso
 * account non si sovrascrivono a vicenda.
 *
 * Un'entry non riconosciuta o non ancora coperta (hashtag, reddit/pinterest) non blocca le altre:
 * finisce in `unsupported`, non in un `throw` che azzera un giro riuscito per metà.
 */
export async function syncSocialFeedEntries(
  db: Db,
  input: { orgId: string; projectId: string | null; nodeId: string; raw: string; limit: number }
): Promise<SocialFeedEntriesOutcome> {
  const { entries, errors } = classifySocialLines(input.raw);
  const unsupported: UnsupportedEntry[] = errors;

  if (!entries.length) {
    return {
      ok: false,
      error: unsupported.length
        ? `not_supported: ${unsupported.map((u) => u.message).join('; ')}`
        : 'unrecognized: nothing here looks like a social handle, profile or post URL'
    };
  }

  const results = await Promise.all(
    entries.map(async (entry) => {
      const fetched = await fetchClassifiedEntry(entry, input.limit);
      if (!fetched.ok) {
        return { entry, error: fetched.error, synced: 0 };
      }

      const posts = await archivePosts(db, input.orgId, input.nodeId, fetched.posts);
      const handle = entry.handle ?? entry.id ?? entry.source;
      const synced = await upsertNodeSocialPosts(db, {
        orgId: input.orgId,
        projectId: input.projectId,
        nodeId: input.nodeId,
        platform: entry.platform,
        handle,
        posts
      });
      return { entry, error: null, synced };
    })
  );

  for (const r of results) {
    if (r.error) {
      unsupported.push({ source: r.entry.source, reason: 'unrecognized', message: r.error });
    }
  }

  const succeeded: SyncedEntry[] = results
    .filter((r) => !r.error)
    .map((r) => ({ platform: r.entry.platform, kind: r.entry.kind, source: r.entry.source, synced: r.synced }));

  return {
    ok: true,
    synced: succeeded.reduce((a, e) => a + e.synced, 0),
    entries: succeeded,
    unsupported
  };
}
