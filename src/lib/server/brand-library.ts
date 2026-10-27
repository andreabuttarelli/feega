import type { Db } from '$lib/server/db/client';
import { findAssets, findOrCreateImportedAsset } from '$lib/server/repos/assets';
import { LibraryTab, engagement, firstMedia, type LibraryItem, type LibraryMediaType } from '$lib/canvas/brand-library';

type Scope = { orgId: string; brandId: string };

const PRODUCTS_LIMIT = 24;
const RECENT_POSTS_LIMIT = 12;
const TOP_SOCIAL_LIMIT = 12;
const ADS_LIMIT = 24;
const SOCIAL_SCAN_LIMIT = 200;
const RECENT = 'Recent';
const TOP_SOCIAL = 'Top social';

async function imported(db: Db, orgId: string, json: unknown): Promise<Pick<LibraryItem, 'assetId' | 'mediaType'>> {
  const media = firstMedia(json);
  if (!media) {
    return { assetId: null, mediaType: null };
  }
  const asset = await findOrCreateImportedAsset(db, { orgId, type: media.type, url: media.url });
  return { assetId: asset.id, mediaType: media.type };
}

async function products(db: Db, scope: Scope): Promise<LibraryItem[]> {
  const { data, error } = await db
    .from('products')
    .select('id, title, price, currency, images, updated_at')
    .eq('org_id', scope.orgId)
    .eq('brand_id', scope.brandId)
    .order('updated_at', { ascending: false })
    .limit(PRODUCTS_LIMIT);
  if (error) {
    throw error;
  }

  return Promise.all(
    (data ?? []).map(async (row) => ({
      id: row.id,
      title: row.title,
      subtitle: row.price == null ? null : `${row.price} ${row.currency ?? ''}`.trim(),
      ...(await imported(db, scope.orgId, row.images))
    }))
  );
}

async function recentPosts(db: Db, scope: Scope): Promise<LibraryItem[]> {
  const { data, error } = await db
    .from('posts')
    .select('id, title, caption, media, created_at')
    .eq('org_id', scope.orgId)
    .eq('brand_id', scope.brandId)
    .order('created_at', { ascending: false })
    .limit(RECENT_POSTS_LIMIT);
  if (error) {
    throw error;
  }

  const firstAssetOf = (media: unknown) => (Array.isArray(media) ? (media[0] as { assetId?: string } | undefined)?.assetId ?? null : null);
  const rows = data ?? [];
  const assets = await findAssets(db, { orgId: scope.orgId, assetIds: rows.map((r) => firstAssetOf(r.media)).filter((id): id is string => Boolean(id)) });

  return rows.map((row) => {
    const asset = assets.get(firstAssetOf(row.media) ?? '');
    const mediaType = asset && (asset.type === 'image' || asset.type === 'video') ? (asset.type as LibraryMediaType) : null;
    return {
      id: row.id,
      title: row.title ?? row.caption ?? 'Post',
      subtitle: row.title ? row.caption : null,
      assetId: mediaType ? asset!.id : null,
      mediaType,
      group: RECENT
    };
  });
}

async function topSocialPosts(db: Db, scope: Scope): Promise<LibraryItem[]> {
  const { data: accounts, error: accountsError } = await db
    .from('social_accounts')
    .select('handle')
    .eq('org_id', scope.orgId)
    .eq('brand_id', scope.brandId);
  if (accountsError) {
    throw accountsError;
  }

  const handles = (accounts ?? []).map((a) => a.handle).filter((h): h is string => Boolean(h));
  if (!handles.length) {
    return [];
  }

  const { data, error } = await db
    .from('social_posts')
    .select('id, platform, caption, media, metrics, posted_at')
    .eq('org_id', scope.orgId)
    .in('handle', handles)
    .order('posted_at', { ascending: false })
    .limit(SOCIAL_SCAN_LIMIT);
  if (error) {
    throw error;
  }

  const top = [...(data ?? [])].sort((a, b) => engagement(b.metrics) - engagement(a.metrics)).slice(0, TOP_SOCIAL_LIMIT);
  return Promise.all(
    top.map(async (row) => ({
      id: row.id,
      title: row.caption ?? row.platform,
      subtitle: `${engagement(row.metrics)} interactions`,
      ...(await imported(db, scope.orgId, row.media)),
      group: TOP_SOCIAL
    }))
  );
}

async function posts(db: Db, scope: Scope): Promise<LibraryItem[]> {
  const [recent, top] = await Promise.all([recentPosts(db, scope), topSocialPosts(db, scope)]);
  return [...recent, ...top];
}

async function ads(db: Db, scope: Scope): Promise<LibraryItem[]> {
  const { data, error } = await db
    .from('competitor_ads')
    .select('id, page_name, creative_title, creative_body, media, last_seen_at')
    .eq('org_id', scope.orgId)
    .eq('brand_id', scope.brandId)
    .order('last_seen_at', { ascending: false })
    .limit(ADS_LIMIT);
  if (error) {
    throw error;
  }

  return Promise.all(
    (data ?? []).map(async (row) => ({
      id: row.id,
      title: row.page_name ?? 'Ad',
      subtitle: row.creative_title ?? row.creative_body,
      ...(await imported(db, scope.orgId, row.media))
    }))
  );
}

export const LIBRARY_LOADERS: Partial<Record<LibraryTab, (db: Db, scope: Scope) => Promise<LibraryItem[]>>> = {
  [LibraryTab.Products]: products,
  [LibraryTab.Posts]: posts,
  [LibraryTab.Ads]: ads
};

export async function brandExists(db: Db, scope: Scope): Promise<boolean> {
  const { data, error } = await db.from('brands').select('id').eq('org_id', scope.orgId).eq('id', scope.brandId).maybeSingle();
  if (error) {
    throw error;
  }
  return Boolean(data);
}
