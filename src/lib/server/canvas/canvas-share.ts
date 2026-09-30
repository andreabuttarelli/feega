import type { Db } from '$lib/server/db/client';
import { listFeedingSelect } from '$lib/canvas/select-node';
import { selectOutputs } from '$lib/canvas/select-outputs';
import { selectOf } from '$lib/canvas-node-data';
import { createServiceRoleDb } from '$lib/server/db/client';
import { SERVICE_ROLE_USES, type ServiceRoleUse } from '$lib/server/db/service-role-uses';
import { listConnections, listNodes, type CanvasNodeRecord } from '$lib/server/repos/canvas';
import { findAssets, type Asset } from '$lib/server/repos/assets';
import { signKnowledgePaths } from '$lib/server/media-archive';
import { signAssetFiles } from '$lib/server/repos/asset-storage';
import type { ThumbnailPreset } from '$lib/server/media-thumbnails';
import { listNodeProducts } from '$lib/server/repos/products';
import { listNodeSocialPosts, type SocialPost } from '$lib/server/repos/social-posts';
import { getInfluencer, listInfluencerViews, signInfluencerViewFiles } from '$lib/server/repos/influencers';
import { nodeSize } from '$lib/canvas/node-size';
import type { NodeType } from '$lib/canvas/node-data';
import { feedFiltersOf, filterPosts, filterProducts, mediaKindOf, productFiltersOf } from '$lib/canvas/source-filters';
import { ShareState, type SharedCanvas, type SharedListItem, type SharedTile, type SharedView } from '$lib/canvas/shared-view';
import { calendarOf } from '$lib/canvas/calendar-node';
import { Capability, modeAllows, modeOf } from '$lib/project-mode';

export { ShareState };

const TOKEN_BYTES = 24;

type SharedPaths = { generated: string[]; uploaded: string[]; influencer: string[] };

export type SignPaths = (paths: SharedPaths, preset?: ThumbnailPreset) => Promise<Map<string, string>>;

const SHARED_IMAGE_PRESET: ThumbnailPreset = 'canvas1024';
const SHARED_FACE_PRESET: ThumbnailPreset = 'canvas512';

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
  audio: refOf,
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
  sourceType: string | null;
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

function audioView(input: ViewInput): SharedView {
  const asset = assetOf(input);
  const url = signedUrl(input, asset);
  return url ? { kind: asset?.type === 'video' ? 'video' : 'audio', url } : EMPTY;
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
  const signed = cover ? await sign({ generated: [], uploaded: [], influencer: [cover.storagePath] }, SHARED_FACE_PRESET) : new Map<string, string>();
  return { kind: 'influencer', name: influencer.name, summary: influencer.summary, photo: cover ? signed.get(cover.storagePath) ?? null : null };
}

const mediaUrl = (m: unknown): string => (typeof m === 'string' ? m : str(record(m).url));

function postView({ node }: ViewInput): SharedView {
  const general = record(node.data.general);
  const caption = str(general.caption);
  const media = list(general.media).map(mediaUrl).filter(Boolean);
  return caption || media.length ? { kind: 'post', caption, media } : EMPTY;
}

function adsView({ node }: ViewInput): SharedView {
  const query = str(node.data.page_name) || str(node.data.search_terms);
  return query ? { kind: 'ads', query, country: str(node.data.country) } : EMPTY;
}

function docView({ node }: ViewInput): SharedView {
  const content = str(node.data.content);
  return content ? { kind: 'doc', content } : EMPTY;
}

function frameView({ node }: ViewInput): SharedView {
  const url = str(node.data.url);
  const html = str(node.data.html);
  return url || html ? { kind: 'frame', url, html } : EMPTY;
}

function calendarView({ node }: ViewInput): SharedView {
  const calendar = calendarOf(node);
  return calendar ? { kind: 'calendar', view: calendar.view, anchor: calendar.anchor } : EMPTY;
}

function selectView({ node, sourceType }: ViewInput): SharedView {
  const outputs = selectOutputs(sourceType, selectOf(node)?.outputs ?? []);
  return {
    kind: 'select',
    index: Number(node.data.index) || 1,
    outputs: outputs.map((o) => ({ label: o.label, port: o.port, incompatible: o.incompatible }))
  };
}

export const SHARED_VIEW_OF: Record<NodeType, (input: ViewInput) => SharedView | Promise<SharedView>> = {
  image: signedView('image'),
  video: signedView('video'),
  text: (input) => {
    const content = assetOf(input)?.content;
    return content ? { kind: 'text', text: content } : EMPTY;
  },
  doc: docView,
  iframe: frameView,
  social_account_feed: feedView,
  social_post_mockup: postView,
  products: productsView,
  ads: adsView,
  influencer: influencerView,
  list: listView,
  select: selectView,
  effects: resultView,
  composition: resultView,
  calendar: calendarView,
  audio: audioView
};

async function viewOf(input: ViewInput): Promise<SharedView> {
  return (await SHARED_VIEW_OF[input.node.type as NodeType]?.(input)) ?? EMPTY;
}

function shareable(assets: Map<string, Asset>): Map<string, Asset> {
  return new Map([...assets].filter(([, asset]) => !asset.uncensored));
}

async function projectShareable(db: Db, canvas: { org_id: string; project_id: string }): Promise<boolean> {
  const { data } = await db.from('projects').select('mode').eq('id', canvas.project_id).eq('org_id', canvas.org_id).maybeSingle();
  return modeAllows(modeOf(data?.mode), Capability.Share);
}

export async function readSharedCanvas(db: Db, token: string, sign: SignPaths): Promise<SharedCanvas | null> {
  if (!token) {
    return null;
  }

  const { data: canvas, error } = await db
    .from('canvases')
    .select('id, org_id, project_id, name')
    .eq('share_token', token)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!canvas || !(await projectShareable(db, canvas))) {
    return null;
  }

  const scope = { orgId: canvas.org_id, canvasId: canvas.id };
  const [nodes, connections] = await Promise.all([listNodes(db, scope), listConnections(db, scope)]);

  const orgId = canvas.org_id;
  const assets = shareable(await findAssets(db, { orgId, assetIds: nodes.flatMap(assetRefsOf) }));

  const files = [...assets.values()].filter((a) => a.url && a.type !== 'text');
  const pathsOf = (list: Asset[]): SharedPaths => ({
    generated: list.filter((a) => a.source === 'generated').map((a) => a.url!),
    uploaded: list.filter((a) => a.source !== 'generated').map((a) => a.url!),
    influencer: []
  });
  const [images, others] = await Promise.all([
    sign(pathsOf(files.filter((a) => a.type === 'image')), SHARED_IMAGE_PRESET),
    sign(pathsOf(files.filter((a) => a.type !== 'image')))
  ]);
  const signed = new Map([...others, ...images]);

  const nodeIds = new Set(nodes.map((n) => n.id));
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const sourceTypeOf = (id: string) => listFeedingSelect(id, connections, nodesById)?.type ?? null;

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
        view: await viewOf({ db, orgId, node, assets, signed, sign, sourceType: sourceTypeOf(node.id) })
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
  return async (paths, preset) => {
    const [rendered, uploaded, faces] = await Promise.all([
      signKnowledgePaths(db as never, paths.generated, undefined, preset),
      signAssetFiles(db, paths.uploaded, undefined, preset),
      signInfluencerViewFiles(db, paths.influencer, preset)
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
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data?.share_token ?? null;
}
