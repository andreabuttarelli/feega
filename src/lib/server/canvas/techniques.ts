import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { listConnections, listNodes } from '$lib/server/repos/canvas';
import { findTechnique, saveTechnique, TechniqueOutcome, type StoredTechnique } from '$lib/server/repos/techniques';
import { packageTechnique, techniquePlan, withInputs, type SlotValue } from '$lib/canvas/technique';
import { GENERATIVE_TYPES } from '$lib/canvas/workflow-plan';
import { writePlan } from './duplicate';
import { enqueueWorkflow } from './workflow';

export enum TechniqueRun {
  Place = 'place',
  Run = 'run'
}

export type SaveOutcome =
  | { outcome: 'saved'; technique: StoredTechnique }
  | { outcome: 'refused'; error: string };

export type RunOutcome =
  | { outcome: 'queued'; workflowId: string; nodeIds: string[] }
  | { outcome: 'placed'; nodeIds: string[] }
  | { outcome: 'refused'; error: string };

export async function saveFromSelection(
  db: Db,
  input: { orgId: string; canvasId: string; nodeIds: string[]; name: string; actor: Actor }
): Promise<SaveOutcome> {
  const scope = { orgId: input.orgId, canvasId: input.canvasId };
  const [nodes, connections] = await Promise.all([listNodes(db, scope), listConnections(db, scope)]);

  const packaged = packageTechnique({
    ids: input.nodeIds,
    nodes: nodes.map((n) => ({ id: n.id, type: n.type, data: n.data, x: n.position.x, y: n.position.y })),
    edges: connections.map((c) => ({ id: c.id, source: c.sourceNodeId, target: c.targetNodeId, sourceHandle: c.sourceHandle, targetHandle: c.targetHandle }))
  });
  if (!packaged.ok) {
    return { outcome: 'refused', error: packaged.reason };
  }

  const written = await saveTechnique(db, input.orgId, input.actor, { name: input.name, technique: packaged.technique });
  return written.outcome === TechniqueOutcome.Ok ? { outcome: 'saved', technique: written.technique } : { outcome: 'refused', error: written.outcome };
}

export async function runTechnique(
  db: Db,
  input: { orgId: string; projectId: string; canvasId: string; userId: string; techniqueId: string; at: { x: number; y: number }; inputs: SlotValue[]; then: TechniqueRun; actor: Actor }
): Promise<RunOutcome> {
  const technique = await findTechnique(db, input.orgId, input.techniqueId);
  if (!technique) {
    return { outcome: 'refused', error: 'technique_not_found' };
  }

  const plan = withInputs(techniquePlan(technique, input.at), input.inputs);
  const written = await writePlan(db, input, plan);
  const nodeIds = written.nodes.map((n) => n.id);
  const generative = written.nodes.filter((n) => GENERATIVE_TYPES.has(n.type)).map((n) => n.id);
  if (input.then === TechniqueRun.Place || generative.length < 2) {
    return { outcome: 'placed', nodeIds };
  }

  const queued = await enqueueWorkflow(db, { orgId: input.orgId, projectId: input.projectId, canvasId: input.canvasId, nodeIds: generative, userId: input.userId, actor: input.actor });
  return queued.kind === 'refused' ? { outcome: 'refused', error: queued.error } : { outcome: 'queued', workflowId: queued.workflowId, nodeIds };
}
