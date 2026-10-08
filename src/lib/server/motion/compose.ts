import type { Db } from '$lib/server/db/client';
import { listProjectAssets, type Asset } from '$lib/server/repos/assets';
import { findNode, listConnections } from '$lib/server/repos/canvas';
import { compositionOf } from '$lib/canvas-node-data';
import { upstreamCards, type UpstreamCard } from '$lib/canvas/composition-node';
import { listRecentNodes } from '$lib/server/repos/dashboard';
import { readHead, readHeads } from '$lib/server/repos/motion-revisions';
import { RevisionOutcome } from '$lib/server/repos/motion-revisions';
import { MOTION_START_DEPS, startMotion, type MotionStart, type MotionStartDeps } from './start';
import { saveMotionDoc } from './editor';
import { applyDraft, composeEditorPath, draftFromDoc, draftFromNode, slotsOf, withEmbeds, type ComposeDraft, type ComposeMedia, type MotionSources } from '$lib/motion/composition-draft';
import type { MotionDoc } from '$lib/motion/doc';
import { COMPOSITION_MEDIA_KINDS } from '$lib/motion/components';
import { newMotionDoc } from '$lib/motion/doc';
import type { LayoutId } from '$lib/canvas/composition/types';

export type ComposeDeps = MotionStartDeps & {
  saveMotionDoc: typeof saveMotionDoc;
  listRecentNodes: typeof listRecentNodes;
  readHead: typeof readHead;
  readHeads: typeof readHeads;
  findNode: typeof findNode;
  listConnections: typeof listConnections;
  listProjectAssets: typeof listProjectAssets;
};

export const COMPOSE_DEPS: ComposeDeps = { ...MOTION_START_DEPS, saveMotionDoc, listRecentNodes, readHead, readHeads, findNode, listConnections, listProjectAssets };

export type ComposeStart = { ok: true; start: MotionStart } | { ok: false; error: string };

type StartInput = { orgId: string; projectId: string; canvasId: string | null; userId: string; name: string; draft: ComposeDraft; base?: MotionDoc };

export async function startComposition(db: Db, deps: ComposeDeps, input: StartInput): Promise<ComposeStart> {
  const doc = applyDraft(input.base ?? newMotionDoc(input.draft.format), input.draft);
  if (!doc.ok) {
    return { ok: false, error: doc.error };
  }

  const start = await startMotion(db, deps, input);
  if (!start) {
    return { ok: false, error: 'canvas_not_found' };
  }

  const actor = { kind: 'user' as const, id: input.userId };
  const write = await deps.saveMotionDoc(db, { orgId: input.orgId, nodeId: start.nodeId, expectedVersion: 0, doc: doc.doc, actor, summary: 'Composition' });
  return write.outcome === RevisionOutcome.Written ? { ok: true, start } : { ok: false, error: 'not_saved' };
}

const MEDIA_KINDS = new Set<string>(COMPOSITION_MEDIA_KINDS);

export function mediaOfRefs(assets: Pick<Asset, 'id' | 'type'>[], refs: string[]): ComposeMedia[] {
  const byId = new Map(assets.map((a) => [a.id, a.type]));
  return refs.flatMap((id) => {
    const type = byId.get(id);
    return type && MEDIA_KINDS.has(type) ? [{ assetId: id, kind: type as ComposeMedia['kind'] }] : [];
  });
}

export type RecentComposition = { id: string; name: string; layout: LayoutId; updatedAt: string; href: string; posterAssetId: string | null; renderAssetId: string | null };

const RECENT_SCAN = 24;
const RECENT_LIMIT = 8;
const UNTITLED = 'Untitled composition';

const idOf = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

export async function recentCompositions(db: Db, deps: ComposeDeps, scope: { orgId: string; projectId: string }): Promise<RecentComposition[]> {
  const nodes = (await deps.listRecentNodes(db, { orgId: scope.orgId, type: 'motion', limit: RECENT_SCAN })).filter((n) => n.projectId === scope.projectId && Number(n.data.docHeadRevision) > 0);
  const heads = await deps.readHeads(db, { orgId: scope.orgId, heads: nodes.map((n) => ({ nodeId: n.id, version: Number(n.data.docHeadRevision) })) });

  return nodes
    .flatMap((node) => {
      const doc = heads.get(node.id)?.doc;
      const draft = doc ? draftFromDoc(doc) : null;
      if (!draft) {
        return [];
      }
      return [
        {
          id: node.id,
          name: node.name ?? UNTITLED,
          layout: draft.layout,
          updatedAt: node.updatedAt,
          href: composeEditorPath({ projectId: scope.projectId, nodeId: node.id }),
          posterAssetId: idOf(node.data.posterAssetId),
          renderAssetId: idOf(node.data.lastRenderAssetId)
        }
      ];
    })
    .slice(0, RECENT_LIMIT);
}

function knownCards(assets: Pick<Asset, 'id' | 'type'>[], cards: UpstreamCard[]): UpstreamCard[] {
  const known = new Set(mediaOfRefs(assets, cards.flatMap((c) => (c.kind === 'motion' ? [] : [c.assetId]))).map((m) => m.assetId));
  return cards.filter((c) => c.kind === 'motion' || known.has(c.assetId));
}

async function headsOf(db: Db, deps: ComposeDeps, orgId: string, cards: UpstreamCard[]): Promise<MotionSources> {
  const motions = cards.filter((c) => c.kind === 'motion');
  const heads = await Promise.all(motions.map((c) => deps.readHead(db, { orgId, nodeId: c.sourceId }).catch(() => null)));
  return Object.fromEntries(motions.map((c, i) => [c.sourceId, heads[i]?.doc ?? null]));
}

type CanvasNodeInput = { orgId: string; projectId: string; canvasId: string; nodeId: string; userId: string };

const MIGRATED_NAME = 'Composition';

export async function openCanvasComposition(db: Db, deps: ComposeDeps, input: CanvasNodeInput): Promise<ComposeStart> {
  const record = await deps.findNode(db, { orgId: input.orgId, nodeId: input.nodeId });
  const onCanvas = record && record.canvasId === input.canvasId && record.projectId === input.projectId;
  const node = onCanvas ? compositionOf(record) : null;
  if (!record || !node) {
    return { ok: false, error: 'node_not_found' };
  }

  const scope = { orgId: input.orgId, canvasId: input.canvasId };
  const [nodes, connections, assets] = await Promise.all([
    deps.listNodes(db, scope),
    deps.listConnections(db, scope),
    deps.listProjectAssets(db, { orgId: input.orgId, projectId: input.projectId })
  ]);
  const edges = connections.map((c) => ({ source: c.sourceNodeId, target: c.targetNodeId }));
  const cards = knownCards(assets, upstreamCards(node.id, edges, nodes));
  const slots = slotsOf(node, cards, await headsOf(db, deps, input.orgId, cards));
  const draft = draftFromNode(node, slots.media);

  return startComposition(db, deps, { ...input, name: record.displayName ?? MIGRATED_NAME, draft, base: withEmbeds(newMotionDoc(draft.format), slots.embeds) });
}
