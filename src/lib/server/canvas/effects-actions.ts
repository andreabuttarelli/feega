import type { Db } from '$lib/server/db/client';
import {
  createConnection,
  createNode,
  DataCheck,
  findNode,
  listConnections,
  listNodes,
  patchNodeData,
  type CanvasNodeRecord
} from '$lib/server/repos/canvas';
import type { Actor } from '$lib/server/repos/actor';
import { validateNodeData } from '$lib/canvas/node-data';
import { cutoutTwin, upstreamMedia, type EffectsMedia } from '$lib/canvas/effects-node';
import { counterpart, hasCutout } from '$lib/canvas/effects/shape-cutout';
import type { EffectStep } from '$lib/canvas/effects';
import { applyEffectsNode } from './apply-effects';

export type EffectsOutcome =
  | { outcome: 'applied'; nodeId: string; assetId: string }
  | { outcome: 'refused'; error: string }
  | { outcome: 'conflict' };

type Scope = { orgId: string; nodeId: string; actor?: Actor };

const EFFECTS_TYPE = 'effects';
const TWIN_GAP = 40;
const DEFAULT_NODE_WIDTH = 280;
const NODE_NOT_FOUND: EffectsOutcome = { outcome: 'refused', error: 'node_not_found' };
const NO_EFFECTS: EffectsOutcome = { outcome: 'refused', error: 'effects mancanti: indica almeno un effetto da applicare' };

export async function applyEffectsTo(db: Db, input: Scope & { effects?: unknown }): Promise<EffectsOutcome> {
  const node = await findNode(db, { orgId: input.orgId, nodeId: input.nodeId });
  if (!node) {
    return NODE_NOT_FOUND;
  }

  if (node.type === EFFECTS_TYPE) {
    return restack(db, node, input);
  }

  const media = mediaOf(node);
  if (!media) {
    return { outcome: 'refused', error: `not_an_image_node: ${node.type} non ha un'immagine o un video da elaborare` };
  }
  if (input.effects === undefined) {
    return NO_EFFECTS;
  }

  const verdict = validateNodeData(EFFECTS_TYPE, { effects: input.effects, sourceRefId: media.refId, refId: null });
  if (!verdict.ok) {
    return { outcome: 'refused', error: verdict.error };
  }

  return spawnBeside(db, input, node, { ...verdict.data, mediaKind: media.kind }, null);
}

export async function makeEffectsPair(db: Db, input: Scope): Promise<EffectsOutcome> {
  const node = await findNode(db, { orgId: input.orgId, nodeId: input.nodeId });
  if (!node || node.type !== EFFECTS_TYPE) {
    return NODE_NOT_FOUND;
  }

  const steps = (Array.isArray(node.data.effects) ? node.data.effects : []) as EffectStep[];
  if (!hasCutout(steps)) {
    return { outcome: 'refused', error: 'no_shape_cutout: la pila non contiene un ritaglio di forme attivo' };
  }

  const connections = await listConnections(db, { orgId: input.orgId, canvasId: node.canvasId });
  const feed = connections.find((edge) => edge.targetNodeId === node.id);
  if (!feed) {
    return { outcome: 'refused', error: 'nessuna immagine collegata al nodo' };
  }

  const existing = await existingTwin(db, input, node, connections);
  if (existing) {
    return existing;
  }

  const twin = { ...node.data, effects: counterpart(steps), refId: null };
  return spawnBeside(db, input, node, twin, feed.sourceNodeId, feed.sourceHandle, feed.targetHandle);
}

async function existingTwin(
  db: Db,
  input: Scope,
  node: CanvasNodeRecord,
  connections: { sourceNodeId: string; targetNodeId: string }[]
): Promise<EffectsOutcome | null> {
  const nodes = await listNodes(db, { orgId: input.orgId, canvasId: node.canvasId });
  const wires = connections.map((edge) => ({ source: edge.sourceNodeId, target: edge.targetNodeId }));
  const twin = nodes.find((other) => other.id === cutoutTwin(node.id, wires, nodes));
  if (!twin) {
    return null;
  }

  const refId = twin.data.refId;
  return typeof refId === 'string' ? { outcome: 'applied', nodeId: twin.id, assetId: refId } : render(db, input, twin.id);
}

async function restack(db: Db, node: CanvasNodeRecord, input: Scope & { effects?: unknown }): Promise<EffectsOutcome> {
  if (input.effects !== undefined) {
    const written = await patchNodeData(db, {
      orgId: input.orgId,
      nodeId: node.id,
      patch: { effects: input.effects },
      check: DataCheck.Schema,
      actor: input.actor
    });
    if (written.outcome === 'invalid') {
      return { outcome: 'refused', error: written.error };
    }
    if (written.outcome !== 'written') {
      return written.outcome === 'gone' ? NODE_NOT_FOUND : { outcome: 'conflict' };
    }
  }

  return render(db, input, node.id);
}

async function spawnBeside(
  db: Db,
  input: Scope,
  beside: CanvasNodeRecord,
  data: Record<string, unknown>,
  feedId: string | null,
  sourceHandle: string | null = null,
  targetHandle: string | null = 'images'
): Promise<EffectsOutcome> {
  const created = await createNode(db, {
    orgId: input.orgId,
    projectId: beside.projectId,
    canvasId: beside.canvasId,
    type: EFFECTS_TYPE,
    x: beside.position.x + (beside.size.width ?? DEFAULT_NODE_WIDTH) + TWIN_GAP,
    y: beside.position.y,
    data,
    actor: input.actor
  });

  await createConnection(db, {
    orgId: input.orgId,
    canvasId: beside.canvasId,
    sourceNodeId: feedId ?? beside.id,
    targetNodeId: created.id,
    sourceHandle,
    targetHandle,
    actor: input.actor
  });

  return render(db, input, created.id);
}

async function render(db: Db, input: Scope, nodeId: string): Promise<EffectsOutcome> {
  const out = await applyEffectsNode(db, { orgId: input.orgId, nodeId, actor: input.actor });
  if (out.outcome !== 'applied') {
    return out;
  }
  return { outcome: 'applied', nodeId, assetId: out.asset.id };
}

function mediaOf(node: CanvasNodeRecord): EffectsMedia | null {
  return upstreamMedia(EFFECTS_TYPE, [{ source: node.id, target: EFFECTS_TYPE }], [{ id: node.id, type: node.type, data: node.data }]);
}
