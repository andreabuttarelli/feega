import type { Db } from '$lib/server/db/client';
import { createServiceRoleDb } from '$lib/server/db/client';
import { SERVICE_ROLE_USES, type ServiceRoleUse } from '$lib/server/db/service-role-uses';
import { listConnections, listNodes, type CanvasNodeRecord } from '$lib/server/repos/canvas';
import { findAssets, type Asset } from '$lib/server/repos/assets';
import { signKnowledgePaths } from '$lib/server/media-archive';
import { signAssetFiles } from '$lib/server/repos/asset-storage';
import { listNodeProducts } from '$lib/server/repos/products';
import { listNodeSocialPosts, type SocialPost } from '$lib/server/repos/social-posts';
import { getInfluencer, listInfluencerViews, signInfluencerViewFiles } from '$lib/server/repos/influencers';
import { nodeSize } from '$lib/canvas/node-size';
import type { NodeType } from '$lib/canvas/node-data';
import { feedFiltersOf, filterPosts, filterProducts, mediaKindOf, productFiltersOf } from '$lib/canvas/source-filters';
import { ShareState, type SharedCanvas, type SharedListItem, type SharedTile, type SharedView } from '$lib/canvas/shared-view';

export { ShareState };

const TOKEN_BYTES = 24;

export type SignPaths = (paths: { generated: string[]; uploaded: string[]; influencer: string[] }) => Promise<Map<string, string>>;

function mintToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function setCanvasShare(
  db: Db,
  input: { orgId: string; canvasId: string; state: ShareState }
): Promise<string | null> {
  const token = input.state === ShareState.On ? mintToken() : null;

  const { error } = await db
    .from('canvases')
    .update({ share_token: token, shared_at: token ? new Date().toISOString() : null })
    .eq('id', input.canvasId)
    .eq('org_id', input.orgId);

  if (error) {
    throw error;
  }
  return token;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

function refOf(node: CanvasNodeRecord): string[] {
  const ref = node.data.refId ?? node.data.assetId;
  return typeof ref === 'string' && ref ? [ref] : [];
}

const listAssetIds = (node: CanvasNodeRecord): string[] =>
  list(node.data.items).map((item) => str(record(item).asset_id)).filter(Boolean);

const ASSET_REFS_OF: Partial<Record<NodeType, (node: CanvasNodeRecord) => string[]>> = {
  image: refOf,
  video: refOf,
  text: refOf,
  effects: refOf,
  composition: refOf,
  list: listAssetIds
};

const assetRefsOf = (node: CanvasNodeRecord): string[] => ASSET_REFS_OF[node.type as NodeType]?.(node) ?? [];

type ViewInput = {
  db: Db;
  orgId: string;
  node: CanvasNodeRecord;
  assets: Map<string, Asset>;
  signed: Map<string, string>;
  sign: SignPaths;
};

const EMPTY: SharedView = { kind: 'empty' };

function assetOf({ node, assets }: ViewInput): Asset | null {
  const [id] = refOf(node);
  return id ? assets.get(id) ?? null : null;
}

function signedUrl(input: ViewInput, asset: Asset | null): string | null {
  return asset?.url ? input.signed.get(asset.url) ?? null : null;
}

function signedView(kind: 'image' | 'video') {
  return (input: ViewInput): SharedView => {
    const url = signedUrl(input, assetOf(input));
    return url ? { kind, url } : EMPTY;
  };
}

function resultView(input: ViewInput): SharedView {
  const asset = assetOf(input);
  const url = signedUrl(input, asset);
  return url ? { kind: asset?.type === 'video' ? 'video' : 'image', url } : EMPTY;
}

const BADGE_OF = { carousel: 'carousel', video: 'video', image: null } as const;

function postThumb(post: SocialPost): string | null {
  const [first] = list(post.media?.items).map(record);
  const cover = post.media?.thumbnailUrl;
  return str(first?.thumbnailUrl) || str(cover) || null;
}

async function feedView({ db, orgId, node }: ViewInput): Promise<SharedView> {
  const posts = await listNodeSocialPosts(db, { orgId, nodeId: node.id });
  const tiles = filterPosts(posts, feedFiltersOf(node.data.filters)).map(
    (post, i): SharedTile => ({ key: String(i), thumb: postThumb(post), label: post.caption ?? '', caption: null, badge: BADGE_OF[mediaKindOf(post.media)] })
  );
  return { kind: 'grid', total: posts.length, tiles };
}

async function productsView({ db, orgId, node }: ViewInput): Promise<SharedView> {
  const products = await listNodeProducts(db, { orgId, nodeId: node.id });
  const tiles = filterProducts(products, productFiltersOf(node.data.filters)).map(
    (p, i): SharedTile => ({
      key: String(i),
      thumb: p.images[0]?.url ?? null,
      label: p.title,
      caption: p.price === null ? null : `${p.currency ?? ''} ${p.price}`.trim(),
      badge: null
    })
  );
  return { kind: 'grid', total: products.length, tiles };
}

function listView(input: ViewInput): SharedView {
  const items = list(input.node.data.items).map(record).map(
    (item): SharedListItem => {
      const asset = input.assets.get(str(item.asset_id)) ?? null;
      return { label: str(item.label), text: str(item.text), url: signedUrl(input, asset) };
    }
  );
  return { kind: 'list', items };
}

async function influencerView({ db, orgId, node, sign }: ViewInput): Promise<SharedView> {
  const influencerId = str(node.data.influencer_id);
  if (!influencerId) {
    return EMPTY;
  }

  const influencer = await getInfluencer(db, influencerId);
  if (!influencer || (influencer.orgId !== null && influencer.orgId !== orgId)) {
    return EMPTY;
  }

  const [cover] = await listInfluencerViews(db, influencer.id);
  const signed = cover ? await sign({ generated: [], uploaded: [], influencer: [cover.storagePath] }) : new Map<string, string>();
  return { kind: 'influencer', name: influencer.name, summary: influencer.summary, photo: cover ? signed.get(cover.storagePath) ?? null : null };
}

const mediaUrl = (m: unknown): string => (typeof m === 'string' ? m : str(record(m).url));

function postView({ node }: ViewInput): SharedView {
  const general = record(node.data.general);
  return { kind: 'post', caption: str(general.caption), media: list(general.media).map(mediaUrl).filter(Boolean) };
}

function adsView({ node }: ViewInput): SharedView {
  return { kind: 'ads', query: str(node.data.page_name) || str(node.data.search_terms), country: str(node.data.country) };
}

export const SHARED_VIEW_OF: Record<NodeType, (input: ViewInput) => SharedView | Promise<SharedView>> = {
  image: signedView('image'),
  video: signedView('video'),
  text: (input) => {
    const content = assetOf(input)?.content;
    return content ? { kind: 'text', text: content } : EMPTY;
  },
  doc: ({ node }) => ({ kind: 'doc', content: str(node.data.content) }),
  iframe: ({ node }) => ({ kind: 'frame', url: str(node.data.url), html: str(node.data.html) }),
  social_account_feed: feedView,
  social_post_mockup: postView,
  products: productsView,
  ads: adsView,
  influencer: influencerView,
  list: listView,
  select: ({ node }) => ({ kind: 'select', index: Number(node.data.index) || 1 }),
  effects: resultView,
  composition: resultView
};

async function viewOf(input: ViewInput): Promise<SharedView> {
  return (await SHARED_VIEW_OF[input.node.type as NodeType]?.(input)) ?? EMPTY;
}

export async function readSharedCanvas(db: Db, token: string, sign: SignPaths): Promise<SharedCanvas | null> {
  if (!token) {
    return null;
  }

  const { data: canvas, error } = await db
    .from('canvases')
    .select('id, org_id, name')
    .eq('share_token', token)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!canvas) {
    return null;
  }

  const scope = { orgId: canvas.org_id, canvasId: canvas.id };
  const [nodes, connections] = await Promise.all([listNodes(db, scope), listConnections(db, scope)]);

  const orgId = canvas.org_id;
  const assets = await findAssets(db, { orgId, assetIds: nodes.flatMap(assetRefsOf) });

  const files = [...assets.values()].filter((a) => a.url && a.type !== 'text');
  const signed = await sign({
    generated: files.filter((a) => a.source === 'generated').map((a) => a.url!),
    uploaded: files.filter((a) => a.source !== 'generated').map((a) => a.url!),
    influencer: []
  });

  const nodeIds = new Set(nodes.map((n) => n.id));

  return {
    name: canvas.name,
    nodes: await Promise.all(nodes.map(async (node) => {
      const fallback = nodeSize(node.type);
      return {
        id: node.id,
        type: node.type,
        displayName: node.displayName,
        x: node.position.x,
        y: node.position.y,
        w: node.size.width ?? fallback.w,
        h: node.size.height ?? fallback.h,
        view: await viewOf({ db, orgId, node, assets, signed, sign })
      };
    })),
    edges: connections
      .filter((c) => nodeIds.has(c.sourceNodeId) && nodeIds.has(c.targetNodeId))
      .map((c) => ({ id: c.id, source: c.sourceNodeId, target: c.targetNodeId }))
  };
}

function shareReadUse(): ServiceRoleUse {
  const use = SERVICE_ROLE_USES.find((entry) => entry.path.startsWith('src/lib/server/canvas/canvas-share.ts'));
  if (!use) {
    throw new Error('readSharedCanvas: voce mancante in service-role-uses.ts');
  }
  return use;
}

export function createShareReadDb(): Db {
  return createServiceRoleDb(shareReadUse());
}

export function signSharedMedia(db: Db): SignPaths {
  return async (paths) => {
    const [rendered, uploaded, faces] = await Promise.all([
      signKnowledgePaths(db as never, paths.generated),
      signAssetFiles(db, paths.uploaded),
      signInfluencerViewFiles(db, paths.influencer)
    ]);
    return new Map([...rendered, ...uploaded, ...faces]);
  };
}

export async function readCanvasShare(db: Db, scope: { orgId: string; canvasId: string }): Promise<string | null> {
  const { data, error } = await db
    .from('canvases')
    .select('share_token')
    .eq('id', scope.canvasId)
    .eq('org_id', scope.orgId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data?.share_token ?? null;
}
