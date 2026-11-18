import type { Db } from '$lib/server/db/client';
import { listConnections, listNodes } from '$lib/server/repos/canvas';
import { runsOf } from '$lib/server/canvas/generate';
import { recordsRevision } from '$lib/server/canvas/revision';
import { listNodeProducts } from '$lib/server/repos/products';
import { listNodeSocialPosts } from '$lib/server/repos/social-posts';
import { getInfluencer, listInfluencerViewsByIds, signInfluencerViewFiles } from '$lib/server/repos/influencers';

export async function canvasSnapshot(db: Db, scope: { orgId: string; canvasId: string }) {
  const [nodes, connections] = await Promise.all([listNodes(db, scope), listConnections(db, scope)]);
  const [runs, { products, socialPosts, influencers }] = await Promise.all([
    loadGenRuns(db, { orgId: scope.orgId, nodes }),
    loadDownloaded(db, { orgId: scope.orgId, canvasId: scope.canvasId, nodes })
  ]);
  return { nodes, connections, runs, products, socialPosts, influencers, revision: recordsRevision(nodes, connections) };
}

export async function loadGenRuns(
  db: Db,
  scope: { orgId: string; nodes: Awaited<ReturnType<typeof listNodes>> }
): Promise<Record<string, unknown[]>> {
  const entries = await Promise.all(
    scope.nodes.map(async (node) => [node.id, await runsOf(db, { orgId: scope.orgId, nodeId: node.id })] as const)
  );
  return Object.fromEntries(entries);
}

export async function loadDownloaded(
  db: Db,
  scope: { orgId: string; canvasId: string; nodes: Awaited<ReturnType<typeof listNodes>> }
): Promise<{
  products: Record<string, unknown[]>;
  socialPosts: Record<string, unknown[]>;
  influencers: Record<string, { name: string; views: { id: string; label: string; url: string | null }[] }>;
}> {
  const influencers: Record<string, { name: string; views: { id: string; label: string; url: string | null }[] }> = {};
  const nodesOfType = (type: string) => scope.nodes.filter((node) => node.type === type);

  const [products, socialPosts] = await Promise.all([
    perNode(nodesOfType('products'), (nodeId) => listNodeProducts(db, { orgId: scope.orgId, nodeId })),
    perNode(nodesOfType('social_account_feed'), (nodeId) => listNodeSocialPosts(db, { orgId: scope.orgId, nodeId })),
    loadInfluencerViews(db, scope.nodes, influencers)
  ]);

  return { products, socialPosts, influencers };
}

async function perNode(nodes: { id: string }[], read: (nodeId: string) => Promise<unknown[]>): Promise<Record<string, unknown[]>> {
  const entries = await Promise.all(nodes.map(async (node) => [node.id, await read(node.id)] as const));
  return Object.fromEntries(entries);
}

async function loadInfluencerViews(
  db: Db,
  nodes: Awaited<ReturnType<typeof listNodes>>,
  out: Record<string, { name: string; views: { id: string; label: string; url: string | null }[] }>
): Promise<void> {
  const influencerNodes = nodes.filter((n) => n.type === 'influencer');
  if (!influencerNodes.length) {
    return;
  }

  const influencerIds = influencerNodes
    .map((n) => (typeof n.data.influencer_id === 'string' ? n.data.influencer_id : null))
    .filter((id): id is string => Boolean(id));

  const [viewsByInfluencer, influencerRows] = await Promise.all([
    listInfluencerViewsByIds(db, influencerIds),
    Promise.all(influencerIds.map((id) => getInfluencer(db, id)))
  ]);

  const allPaths = [...viewsByInfluencer.values()].flatMap((views) => views.map((v) => v.storagePath));
  const signed = await signInfluencerViewFiles(db, allPaths, 'canvas512');

  const nameById = new Map(influencerRows.filter((r) => r !== null).map((r) => [r.id, r.name]));

  for (const node of influencerNodes) {
    const influencerId = typeof node.data.influencer_id === 'string' ? node.data.influencer_id : null;
    if (!influencerId) continue;

    const views = viewsByInfluencer.get(influencerId) ?? [];
    out[node.id] = {
      name: nameById.get(influencerId) ?? 'Influencer',
      views: views.map((v) => ({ id: v.id, label: v.label, url: signed.get(v.storagePath) ?? null }))
    };
  }
}
