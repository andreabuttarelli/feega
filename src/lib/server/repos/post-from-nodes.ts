import type { Db } from '$lib/server/db/client';
import type { CanvasNodeRecord } from '$lib/server/repos/canvas';
import type { PostMedia, Post } from '$lib/server/repos/posts';
import type { ActorKind } from '$lib/server/repos/posts';
import { nodeMediaAsset } from '$lib/canvas/node-media';


type CanvasRepo = {
  listNodesByIds: (db: Db, scope: { orgId: string; nodeIds: string[] }) => Promise<CanvasNodeRecord[]>;
};

type PostsRepo = {
  promoteToPost: (
    db: Db,
    input: {
      orgId: string;
      brandId: string;
      caption: string;
      media: PostMedia[];
      actorKind?: ActorKind;
      actorId?: string | null;
      sources?: { nodeId: string; role?: string }[];
      plannedFor?: string | null;
    }
  ) => Promise<Post>;
};

function readingOrder(a: CanvasNodeRecord, b: CanvasNodeRecord): number {
  return a.position.y - b.position.y || a.position.x - b.position.x;
}

function captionOf(node: CanvasNodeRecord): string | null {
  if (node.type === 'doc' && typeof node.data.content === 'string') return node.data.content;
  if (node.type === 'text' && node.data.running !== true && typeof node.data.refId === 'string') {
    return typeof node.data.prompt === 'string' ? node.data.prompt : null;
  }
  return null;
}

function byMediaOrder(mediaOrder: string[]): (a: { nodeId: string }, b: { nodeId: string }) => number {
  return (a, b) => mediaOrder.indexOf(a.nodeId) - mediaOrder.indexOf(b.nodeId);
}

export async function promoteNodesToPost(
  db: Db,
  repos: { canvas: CanvasRepo; posts: PostsRepo },
  input: {
    orgId: string;
    brandId: string;
    nodeIds: string[];
    caption?: string;
    mediaOrder?: string[];
    actorKind?: ActorKind;
    actorId?: string | null;
    plannedFor?: string | null;
  }
): Promise<Post> {
  const nodes = await repos.canvas.listNodesByIds(db, { orgId: input.orgId, nodeIds: input.nodeIds });

  const foundIds = new Set(nodes.map((n) => n.id));
  const missing = input.nodeIds.filter((id) => !foundIds.has(id));
  if (missing.length) {
    throw new Error(`node_not_found: ${missing.join(', ')}`);
  }

  const readOrder = [...nodes].sort(readingOrder);

  const mediaAssets: { nodeId: string; assetId: string }[] = [];
  const sources: { nodeId: string; role: string }[] = [];
  const captionParts: string[] = [];

  for (const node of readOrder) {
    const caption = captionOf(node);
    if (caption !== null) {
      if (input.caption === undefined) {
        captionParts.push(caption);
      }
      sources.push({ nodeId: node.id, role: 'caption' });
      continue;
    }

    const assetId = nodeMediaAsset(node);
    if (assetId) {
      mediaAssets.push({ nodeId: node.id, assetId });
      sources.push({ nodeId: node.id, role: 'media' });
      continue;
    }

    sources.push({ nodeId: node.id, role: 'reference' });
  }

  const orderedMediaAssets = input.mediaOrder
    ? mediaAssets.filter((m) => input.mediaOrder!.includes(m.nodeId)).sort(byMediaOrder(input.mediaOrder))
    : mediaAssets;

  const media: PostMedia[] = orderedMediaAssets.map((m, index) => ({
    assetId: m.assetId,
    order: index,
    role: 'media'
  }));

  return repos.posts.promoteToPost(db, {
    orgId: input.orgId,
    brandId: input.brandId,
    caption: input.caption ?? captionParts.join('\n\n'),
    media,
    actorKind: input.actorKind,
    actorId: input.actorId,
    sources,
    plannedFor: input.plannedFor
  });
}
