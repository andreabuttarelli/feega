import type { Db } from '$lib/server/db/client';
import { findAssets, findOrCreateImportedAsset } from '$lib/server/repos/assets';
import { findOrCreateColourAsset } from '$lib/server/brand-colour-asset';
import { tokenizeChips } from '$lib/canvas/brand-content-chips';
import { logosSchema, paletteSchema, voiceSchema, type Palette } from '$lib/brand-kit';
import { LibraryTab, engagement, firstMedia, type LibraryItem, type LibraryMediaType } from '$lib/canvas/brand-library';

type Scope = { orgId: string; brandId: string };

const PRODUCTS_LIMIT = 24;
const RECENT_POSTS_LIMIT = 12;
const TOP_SOCIAL_LIMIT = 12;
const ADS_LIMIT = 24;
const SOCIAL_SCAN_LIMIT = 200;
const APPROVED_LIMIT = 24;
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

const SOCIAL_COLUMNS = 'id, platform, caption, media, metrics, posted_at';

type SocialRow = { id: string; platform: string; caption: string | null; media: unknown; metrics: unknown; posted_at: string | null };

async function brandHandles(db: Db, scope: Scope): Promise<string[]> {
  const { data, error } = await db.from('social_accounts').select('handle').eq('org_id', scope.orgId).eq('brand_id', scope.brandId);
  if (error) {
    throw error;
  }
  return (data ?? []).map((a) => a.handle).filter((h): h is string => Boolean(h));
}

async function socialRows(db: Db, scope: Scope): Promise<SocialRow[]> {
  const handles = await brandHandles(db, scope);
  const linked = db.from('social_posts').select(SOCIAL_COLUMNS).eq('org_id', scope.orgId).eq('brand_id', scope.brandId).limit(SOCIAL_SCAN_LIMIT);
  const byHandle = handles.length
    ? db.from('social_posts').select(SOCIAL_COLUMNS).eq('org_id', scope.orgId).in('handle', handles).limit(SOCIAL_SCAN_LIMIT)
    : Promise.resolve({ data: [], error: null });

  const [a, b] = await Promise.all([linked, byHandle]);
  if (a.error) {
    throw a.error;
  }
  if (b.error) {
    throw b.error;
  }

  const unique = new Map<string, SocialRow>();
  for (const row of [...(a.data ?? []), ...(b.data ?? [])] as SocialRow[]) {
    unique.set(row.id, row);
  }
  return [...unique.values()];
}

async function topSocialPosts(db: Db, scope: Scope): Promise<LibraryItem[]> {
  const top = (await socialRows(db, scope)).sort((a, b) => engagement(b.metrics) - engagement(a.metrics)).slice(0, TOP_SOCIAL_LIMIT);
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

function parsed<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }, value: unknown, fallback: T): T {
  const result = schema.safeParse(value);
  return result.success ? (result.data as T) : fallback;
}

function contentPalette(content: string | null): Palette {
  const hexes = tokenizeChips(content ?? '').flatMap((t) => (t.kind === 'colour' ? [t.hex.toUpperCase()] : []));
  return [...new Set(hexes)].map((hex) => ({ hex }));
}

async function logoItems(db: Db, scope: Scope, logos: unknown): Promise<LibraryItem[]> {
  return Promise.all(
    parsed(logosSchema, logos, []).map(async (logo) => {
      const asset = await findOrCreateImportedAsset(db, { orgId: scope.orgId, type: 'image', url: logo.url });
      return { id: `logo:${logo.variant}`, title: logo.variant, subtitle: null, assetId: asset.id, mediaType: 'image' as const, group: 'Logos' };
    })
  );
}

async function paletteItems(db: Db, scope: Scope, palette: Palette): Promise<LibraryItem[]> {
  return Promise.all(
    palette.map(async (swatch) => {
      const found = await findOrCreateColourAsset(db, { orgId: scope.orgId, hex: swatch.hex });
      return {
        id: `colour:${swatch.hex}`,
        title: swatch.hex,
        subtitle: swatch.name ?? null,
        assetId: found?.asset.id ?? null,
        mediaType: found ? ('image' as const) : null,
        group: 'Palette'
      };
    })
  );
}

async function fontItems(db: Db, scope: Scope): Promise<LibraryItem[]> {
  const { data, error } = await db
    .from('brand_fonts')
    .select('id, role, google_family, org_font_id')
    .eq('org_id', scope.orgId)
    .eq('brand_id', scope.brandId);
  if (error) {
    throw error;
  }

  const rows = data ?? [];
  const uploadedIds = rows.map((r) => r.org_font_id).filter((id): id is string => Boolean(id));
  const families = await uploadedFamilies(db, scope.orgId, uploadedIds);

  return rows.map((row) => ({
    id: row.id,
    title: row.google_family ?? families.get(row.org_font_id ?? '') ?? 'Uploaded font',
    subtitle: row.role,
    assetId: null,
    mediaType: null,
    group: 'Fonts'
  }));
}

async function uploadedFamilies(db: Db, orgId: string, ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) {
    return new Map();
  }
  const { data, error } = await (db as unknown as { from: (t: string) => ReturnType<Db['from']> })
    .from('org_fonts')
    .select('id, family')
    .eq('org_id', orgId)
    .in('id', ids);
  if (error) {
    return new Map();
  }
  return new Map(((data ?? []) as Array<{ id: string; family: string }>).map((r) => [r.id, r.family]));
}

function voiceItems(voice: unknown): LibraryItem[] {
  const v = parsed(voiceSchema, voice, {});
  const entries: Array<[string, string | undefined]> = [
    ['Tone', v.tone],
    ['Do', v.do?.join('\n')],
    ["Don't", v.dont?.join('\n')]
  ];
  return entries
    .filter((e): e is [string, string] => Boolean(e[1]))
    .map(([title, text]) => ({ id: `voice:${title}`, title, subtitle: text, assetId: null, mediaType: null, group: 'Voice' }));
}

async function approvedItems(db: Db, scope: Scope): Promise<LibraryItem[]> {
  const { data, error } = await db
    .from('assets')
    .select('id, type, approved_at')
    .eq('org_id', scope.orgId)
    .eq('brand_id', scope.brandId)
    .order('approved_at', { ascending: false })
    .limit(APPROVED_LIMIT);
  if (error) {
    throw error;
  }

  return (data ?? [])
    .filter((row) => row.approved_at && (row.type === 'image' || row.type === 'video'))
    .map((row) => ({ id: row.id, title: row.id, subtitle: null, assetId: row.id, mediaType: row.type as LibraryMediaType, group: 'Approved' }));
}

async function kit(db: Db, scope: Scope): Promise<LibraryItem[]> {
  const { data: brand, error } = await db
    .from('brands')
    .select('content, palette, logos, voice')
    .eq('org_id', scope.orgId)
    .eq('id', scope.brandId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!brand) {
    return [];
  }

  const palette = parsed(paletteSchema, brand.palette, []);
  const [logos, swatches, fonts, approved] = await Promise.all([
    logoItems(db, scope, brand.logos),
    paletteItems(db, scope, palette.length ? palette : contentPalette(brand.content)),
    fontItems(db, scope),
    approvedItems(db, scope)
  ]);
  return [...logos, ...swatches, ...fonts, ...voiceItems(brand.voice), ...approved];
}

export const LIBRARY_LOADERS: Partial<Record<LibraryTab, (db: Db, scope: Scope) => Promise<LibraryItem[]>>> = {
  [LibraryTab.Kit]: kit,
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
