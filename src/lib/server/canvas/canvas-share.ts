import type { Db } from '$lib/server/db/client';
import { createServiceRoleDb } from '$lib/server/db/client';
import { SERVICE_ROLE_USES, type ServiceRoleUse } from '$lib/server/db/service-role-uses';
import { listConnections, listNodes, type CanvasNodeRecord } from '$lib/server/repos/canvas';
import { findAssets, type Asset } from '$lib/server/repos/assets';
import { signKnowledgePaths } from '$lib/server/media-archive';
import { signAssetFiles } from '$lib/server/repos/asset-storage';
import { nodeSize } from '$lib/canvas/node-size';
import { ShareState, type SharedCanvas, type SharedView } from '$lib/canvas/shared-view';

export { ShareState };

const TOKEN_BYTES = 24;

export type SignPaths = (paths: { generated: string[]; uploaded: string[] }) => Promise<Map<string, string>>;

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

const MEDIA_TYPES = new Set(['image', 'video', 'text']);

function assetIdOf(node: CanvasNodeRecord): string | null {
  const ref = node.data.refId ?? node.data.assetId;
  return typeof ref === 'string' && ref ? ref : null;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

type ViewInput = { node: CanvasNodeRecord; asset: Asset | null; signed: Map<string, string> };

function signedView(kind: 'image' | 'video') {
  return ({ asset, signed }: ViewInput): SharedView => {
    const url = asset?.url ? signed.get(asset.url) : null;
    return url ? { kind, url } : { kind: 'empty' };
  };
}

const VIEW_OF: Record<string, (input: ViewInput) => SharedView> = {
  image: signedView('image'),
  video: signedView('video'),
  text: ({ asset }) => (asset?.content ? { kind: 'text', text: asset.content } : { kind: 'empty' }),
  doc: ({ node }) => ({ kind: 'doc', content: str(node.data.content) }),
  iframe: ({ node }) => ({ kind: 'frame', url: str(node.data.url), html: str(node.data.html) })
};

function viewOf(input: ViewInput): SharedView {
  return VIEW_OF[input.node.type]?.(input) ?? { kind: 'empty' };
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

  const assetIds = nodes.filter((n) => MEDIA_TYPES.has(n.type)).map(assetIdOf).filter((id): id is string => id !== null);
  const assets = await findAssets(db, { orgId: canvas.org_id, assetIds });

  const files = [...assets.values()].filter((a) => a.url && a.type !== 'text');
  const signed = await sign({
    generated: files.filter((a) => a.source === 'generated').map((a) => a.url!),
    uploaded: files.filter((a) => a.source !== 'generated').map((a) => a.url!)
  });

  const nodeIds = new Set(nodes.map((n) => n.id));

  return {
    name: canvas.name,
    nodes: nodes.map((node) => {
      const fallback = nodeSize(node.type);
      const assetId = assetIdOf(node);
      return {
        id: node.id,
        type: node.type,
        displayName: node.displayName,
        x: node.position.x,
        y: node.position.y,
        w: node.size.width ?? fallback.w,
        h: node.size.height ?? fallback.h,
        view: viewOf({ node, asset: assetId ? assets.get(assetId) ?? null : null, signed })
      };
    }),
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
    const [rendered, uploaded] = await Promise.all([
      signKnowledgePaths(db as never, paths.generated),
      signAssetFiles(db, paths.uploaded)
    ]);
    return new Map([...rendered, ...uploaded]);
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
