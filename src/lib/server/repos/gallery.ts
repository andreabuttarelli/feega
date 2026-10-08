import type { Db } from '$lib/server/db/client';
import type { Json } from '$lib/database.types';
import { parseMotionDoc, type MotionDoc, type MotionFormat } from '$lib/motion/doc';
import { DURATION_BANDS, GalleryStatus, type GalleryAsset, type GalleryCard, type GalleryItem, type GalleryKind, type GallerySearch } from '$lib/gallery/model';
import { actorCols, type Actor } from './actor';

const CARD_COLUMNS =
  'id, title, author_name, kind, format, duration_s, tags, poster_url, preview_url, remix_count, origin:gallery_items!gallery_items_remixed_from_fkey(id, title, author_name)';
const ITEM_COLUMNS = `${CARD_COLUMNS}, description, status, doc, assets, published_at`;

type OriginRow = { id: string; title: string; author_name: string } | null;

type CardRow = {
  id: string;
  title: string;
  author_name: string;
  kind: string;
  format: string;
  duration_s: number | string;
  tags: string[];
  poster_url: string | null;
  preview_url: string | null;
  remix_count: number;
  origin: OriginRow | OriginRow[];
};

type ItemRow = CardRow & { description: string; status: string; doc: unknown; assets: unknown; published_at: string | null };

const LIKE_SPECIALS = /[%_\\,()]/g;

function originOf(raw: OriginRow | OriginRow[]): GalleryCard['remixedFrom'] {
  const row = Array.isArray(raw) ? (raw[0] ?? null) : raw;
  return row ? { id: row.id, title: row.title, authorName: row.author_name } : null;
}

function toCard(row: CardRow): GalleryCard {
  return {
    id: row.id,
    title: row.title,
    authorName: row.author_name,
    kind: row.kind as GalleryKind,
    format: row.format as MotionFormat,
    durationS: Number(row.duration_s),
    tags: row.tags ?? [],
    posterUrl: row.poster_url,
    previewUrl: row.preview_url,
    remixCount: row.remix_count,
    remixedFrom: originOf(row.origin)
  };
}

function toItem(row: ItemRow): GalleryItem | null {
  const parsed = parseMotionDoc(row.doc);
  if (!parsed.ok) {
    return null;
  }
  return {
    ...toCard(row),
    description: row.description,
    status: row.status as GalleryStatus,
    doc: parsed.doc,
    assets: (Array.isArray(row.assets) ? row.assets : []) as GalleryAsset[],
    publishedAt: row.published_at
  };
}

export async function listGallery(db: Db, search: GallerySearch): Promise<GalleryCard[]> {
  let query = db.from('gallery_items').select(CARD_COLUMNS).eq('status', GalleryStatus.Published);

  if (search.kind) {
    query = query.eq('kind', search.kind);
  }
  if (search.format) {
    query = query.eq('format', search.format);
  }
  if (search.duration) {
    const band = DURATION_BANDS[search.duration];
    query = query.gt('duration_s', band.min);
    query = Number.isFinite(band.max) ? query.lte('duration_s', band.max) : query;
  }
  if (search.min !== undefined) {
    query = query.gte('duration_s', search.min);
  }
  if (search.max !== undefined) {
    query = query.lte('duration_s', search.max);
  }
  if (search.tag) {
    query = query.contains('tags', [search.tag]);
  }
  if (search.q) {
    query = query.ilike('title', `%${search.q.replace(LIKE_SPECIALS, ' ')}%`);
  }

  const { data, error } = await query.order('published_at', { ascending: false }).limit(search.limit);
  if (error) {
    throw error;
  }
  return ((data ?? []) as unknown as CardRow[]).map(toCard);
}

export async function findGalleryItem(db: Db, id: string): Promise<GalleryItem | null> {
  const { data, error } = await db.from('gallery_items').select(ITEM_COLUMNS).eq('id', id).neq('status', GalleryStatus.Removed).maybeSingle();
  if (error) {
    throw error;
  }
  return data ? toItem(data as unknown as ItemRow) : null;
}

export type NewGalleryItem = {
  orgId: string;
  userId: string;
  authorName: string;
  title: string;
  description: string;
  tags: string[];
  kind: GalleryKind;
  format: MotionFormat;
  durationS: number;
  doc: MotionDoc;
  sourceNodeId: string | null;
  remixedFrom: string | null;
  actor: Actor;
};

export async function insertGalleryItem(db: Db, input: NewGalleryItem & { id?: string }): Promise<string> {
  const { data, error } = await db
    .from('gallery_items')
    .insert({
      ...(input.id ? { id: input.id } : {}),
      org_id: input.orgId,
      user_id: input.userId,
      author_name: input.authorName,
      title: input.title,
      description: input.description,
      tags: input.tags,
      kind: input.kind,
      format: input.format,
      duration_s: input.durationS,
      doc: input.doc as unknown as Json,
      source_node_id: input.sourceNodeId,
      remixed_from: input.remixedFrom,
      status: GalleryStatus.Unlisted,
      ...actorCols(input.actor)
    } as never)
    .select('id')
    .single();
  if (error) {
    throw error;
  }
  return (data as { id: string }).id;
}

export type GalleryRelease = { doc: MotionDoc; assets: GalleryAsset[]; posterUrl: string | null; previewUrl: string | null };

export async function releaseGalleryItem(db: Db, input: { orgId: string; id: string; release: GalleryRelease }): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await db
    .from('gallery_items')
    .update({
      doc: input.release.doc as unknown as Json,
      assets: input.release.assets as unknown as Json,
      poster_url: input.release.posterUrl,
      preview_url: input.release.previewUrl,
      status: GalleryStatus.Published,
      published_at: now,
      updated_at: now
    })
    .eq('org_id', input.orgId)
    .eq('id', input.id);
  if (error) {
    throw error;
  }
}

export async function withdrawGalleryItem(db: Db, input: { orgId: string; id: string }): Promise<boolean> {
  const { data, error } = await db
    .from('gallery_items')
    .update({ status: GalleryStatus.Removed, updated_at: new Date().toISOString() })
    .eq('org_id', input.orgId)
    .eq('id', input.id)
    .neq('status', GalleryStatus.Removed)
    .select('id');
  if (error) {
    throw error;
  }
  return Boolean(data?.length);
}

export async function nodeGalleryItem(db: Db, input: { orgId: string; nodeId: string }): Promise<{ id: string; title: string; status: GalleryStatus } | null> {
  const { data, error } = await db
    .from('gallery_items')
    .select('id, title, status')
    .eq('org_id', input.orgId)
    .eq('source_node_id', input.nodeId)
    .neq('status', GalleryStatus.Removed)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data ? { id: data.id, title: data.title, status: data.status as GalleryStatus } : null;
}

export async function recordRemix(db: Db, input: { orgId: string; itemId: string; nodeId: string; actor: Actor }): Promise<void> {
  const { error } = await db.from('gallery_remixes').insert({ org_id: input.orgId, item_id: input.itemId, node_id: input.nodeId, ...actorCols(input.actor) } as never);
  if (error) {
    throw error;
  }
}

export async function remixOrigin(db: Db, input: { orgId: string; nodeId: string }): Promise<{ id: string; title: string; authorName: string } | null> {
  const { data, error } = await db
    .from('gallery_remixes')
    .select('item:gallery_items(id, title, author_name)')
    .eq('org_id', input.orgId)
    .eq('node_id', input.nodeId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  const item = originOf(((data as { item: OriginRow | OriginRow[] } | null)?.item ?? null) as OriginRow);
  return item;
}
