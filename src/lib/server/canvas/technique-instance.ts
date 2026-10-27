import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { DataCheck, createCanvas, createNode, deleteNode, findNode, listCanvases, listConnections, listNodes, patchNodeData } from '$lib/server/repos/canvas';
import { findTechnique, type StoredTechnique } from '$lib/server/repos/techniques';
import { techniquePlan, withInputs } from '$lib/canvas/technique';
import { RUN_ROW_HEIGHT, RUNS_CANVAS, TECHNIQUE_NODE, editCanvasName, instanceInputs, nextRunRow } from '$lib/canvas/technique-instance';
import { nodeSize } from '$lib/canvas/node-size';
import { GENERATIVE_TYPES } from '$lib/canvas/workflow-plan';
import { writePlan } from './duplicate';
import { BATCH_MAX_ROWS, autoMapping, batchRowValues, type ColumnMapping } from '$lib/canvas/technique-batch';
import { runsByIds } from '$lib/server/repos/node-runs';
import type { GenMedium } from '$lib/canvas/gen-node';
import { cancelWorkflow, enqueueWorkflow, estimateWorkflowCredits } from './workflow';
import { runTechnique, TechniqueRun } from './techniques';

const CHECK_VIOLATION = '23514';
const NOT_FOUND = 'technique_not_found';
const COPY_MESSAGE = 'Live techniques are not enabled yet, so this is a copy. Editing the technique will not update it.';

export enum InstancePlaced {
  Live = 'live',
  Copy = 'copy'
}

type Scope = { orgId: string; projectId: string };
type Refused = { outcome: 'refused'; error: string };

export type PlaceOutcome = { outcome: 'placed'; mode: InstancePlaced; nodeIds: string[]; message?: string } | Refused;
export type RunInstanceOutcome = { outcome: 'queued'; workflowId: string; canvasId: string } | Refused;
export type DetachOutcome = { outcome: 'detached'; nodeIds: string[]; removedId: string } | Refused;
export type PreviewOutcome = { outcome: 'preview'; rows: number; creditsPerRow: number; credits: number } | Refused;
export type RowsOutcome = { outcome: 'queued'; canvasId: string; workflowIds: string[]; runIds: string[] } | Refused;
export type RowsProgress = { total: number; done: number; failed: number; running: number };
export type OpenOutcome = { outcome: 'opened'; canvasId: string; name: string } | Refused;

const refused = (error: string): Refused => ({ outcome: 'refused', error });

const isTypeRefused = (error: unknown) => (error as { code?: string } | null)?.code === CHECK_VIOLATION;

export async function placeInstance(
  db: Db,
  input: Scope & { canvasId: string; userId: string; techniqueId: string; at: { x: number; y: number }; actor: Actor }
): Promise<PlaceOutcome> {
  const technique = await findTechnique(db, input.orgId, input.techniqueId);
  if (!technique) {
    return refused(NOT_FOUND);
  }

  const size = nodeSize(TECHNIQUE_NODE);
  try {
    const node = await createNode(db, { ...input, type: TECHNIQUE_NODE, x: input.at.x, y: input.at.y, width: size.w, height: size.h, data: { techniqueId: technique.id, name: technique.name } });
    return { outcome: 'placed', mode: InstancePlaced.Live, nodeIds: [node.id] };
  } catch (error) {
    if (!isTypeRefused(error)) {
      throw error;
    }
  }

  const copied = await runTechnique(db, { ...input, inputs: [], then: TechniqueRun.Place });
  return copied.outcome === 'refused' ? copied : { outcome: 'placed', mode: InstancePlaced.Copy, nodeIds: copied.nodeIds, message: COPY_MESSAGE };
}

async function wiredTexts(db: Db, input: { orgId: string; canvasId: string; nodeId: string }): Promise<string[]> {
  const connections = (await listConnections(db, input)).filter((c) => c.targetNodeId === input.nodeId).sort((a, b) => a.id.localeCompare(b.id));
  const sources = await Promise.all(connections.map((c) => findNode(db, { orgId: input.orgId, nodeId: c.sourceNodeId })));
  return sources.flatMap((s) => [s?.data.content ?? s?.data.prompt]).filter((text): text is string => typeof text === 'string' && text.trim() !== '');
}

async function runsCanvas(db: Db, scope: Scope): Promise<{ id: string; ys: number[] }> {
  const existing = (await listCanvases(db, scope)).find((c) => c.name === RUNS_CANVAS);
  const canvas = existing ?? (await createCanvas(db, { ...scope, name: RUNS_CANVAS }));
  const nodes = existing ? await listNodes(db, { orgId: scope.orgId, canvasId: canvas.id }) : [];
  return { id: canvas.id, ys: nodes.map((n) => n.position.y) };
}

async function clearRow(db: Db, input: { orgId: string; canvasId: string; y: number; actor: Actor }) {
  const nodes = await listNodes(db, { orgId: input.orgId, canvasId: input.canvasId });
  const row = nodes.filter((n) => n.position.y >= input.y && n.position.y < input.y + RUN_ROW_HEIGHT);
  await Promise.all(row.map((n) => deleteNode(db, { orgId: input.orgId, nodeId: n.id, actor: input.actor })));
}

export async function runInstance(
  db: Db,
  input: Scope & { userId: string; nodeId: string; actor: Actor }
): Promise<RunInstanceOutcome> {
  const node = await findNode(db, { orgId: input.orgId, nodeId: input.nodeId });
  if (!node || node.type !== TECHNIQUE_NODE) {
    return refused('not_a_technique');
  }

  const technique = await findTechnique(db, input.orgId, String(node.data.techniqueId));
  if (!technique) {
    return refused(NOT_FOUND);
  }

  const texts = await wiredTexts(db, { orgId: input.orgId, canvasId: node.canvasId, nodeId: node.id });
  const runs = await runsCanvas(db, input);
  const previous = typeof node.data.runY === 'number' ? node.data.runY : null;
  const row = previous ?? nextRunRow(runs.ys);
  if (previous !== null) {
    await clearRow(db, { orgId: input.orgId, canvasId: runs.id, y: row, actor: input.actor });
  }

  const plan = withInputs(techniquePlan(technique, { x: 0, y: row }), instanceInputs(technique.inputs, texts));
  const written = await writePlan(db, { orgId: input.orgId, projectId: input.projectId, canvasId: runs.id, actor: input.actor }, plan);
  const generative = written.nodes.filter((n) => GENERATIVE_TYPES.has(n.type)).map((n) => n.id);
  if (generative.length < 2) {
    return refused('A technique needs two generation nodes to run');
  }

  const queued = await enqueueWorkflow(db, { orgId: input.orgId, projectId: input.projectId, canvasId: runs.id, nodeIds: generative, userId: input.userId, actor: input.actor });
  if (queued.kind === 'refused') {
    return refused(queued.error);
  }

  await patchNodeData(db, { orgId: input.orgId, nodeId: node.id, patch: { runY: row, workflowId: queued.workflowId, ranVersion: technique.version }, check: DataCheck.None, actor: input.actor });
  return { outcome: 'queued', workflowId: queued.workflowId, canvasId: runs.id };
}

export async function detachInstance(
  db: Db,
  input: Scope & { canvasId: string; nodeId: string; actor: Actor }
): Promise<DetachOutcome> {
  const node = await findNode(db, { orgId: input.orgId, nodeId: input.nodeId });
  if (!node || node.type !== TECHNIQUE_NODE) {
    return refused('not_a_technique');
  }

  const technique = await findTechnique(db, input.orgId, String(node.data.techniqueId));
  if (!technique) {
    return refused(NOT_FOUND);
  }

  const written = await writePlan(db, input, techniquePlan(technique, node.position));
  await deleteNode(db, { orgId: input.orgId, nodeId: node.id, actor: input.actor });
  return { outcome: 'detached', nodeIds: written.nodes.map((n) => n.id), removedId: node.id };
}

async function editCanvas(db: Db, scope: Scope, technique: StoredTechnique, actor: Actor): Promise<string> {
  const name = editCanvasName(technique.name);
  const existing = (await listCanvases(db, scope)).find((c) => c.name === name);
  if (!existing) {
    return (await createCanvas(db, { ...scope, name })).id;
  }

  const stale = await listNodes(db, { orgId: scope.orgId, canvasId: existing.id });
  await Promise.all(stale.map((n) => deleteNode(db, { orgId: scope.orgId, nodeId: n.id, actor })));
  return existing.id;
}

export async function openDefinition(db: Db, input: Scope & { techniqueId: string; actor: Actor }): Promise<OpenOutcome> {
  const technique = await findTechnique(db, input.orgId, input.techniqueId);
  if (!technique) {
    return refused(NOT_FOUND);
  }

  const canvasId = await editCanvas(db, input, technique, input.actor);
  await writePlan(db, { orgId: input.orgId, projectId: input.projectId, canvasId, actor: input.actor }, techniquePlan(technique, { x: 0, y: 0 }));
  return { outcome: 'opened', canvasId, name: editCanvasName(technique.name) };
}

const mediumOf = (type: string): GenMedium => (type === 'text' || type === 'video' ? type : 'image');

export async function previewRows(db: Db, input: { orgId: string; techniqueId: string; rowCount: number }): Promise<PreviewOutcome> {
  const technique = await findTechnique(db, input.orgId, input.techniqueId);
  if (!technique) {
    return refused(NOT_FOUND);
  }

  const steps = technique.plan.nodes
    .filter((n) => GENERATIVE_TYPES.has(n.type))
    .map((n) => ({ medium: mediumOf(n.type), model: typeof n.data.model === 'string' ? n.data.model : null }));
  const creditsPerRow = estimateWorkflowCredits(steps);
  return { outcome: 'preview', rows: input.rowCount, creditsPerRow, credits: creditsPerRow * input.rowCount };
}

export async function runRows(
  db: Db,
  input: Scope & { userId: string; techniqueId: string; rows: string[][]; mapping: ColumnMapping | null; actor: Actor }
): Promise<RowsOutcome> {
  if (input.rows.length === 0) {
    return refused('no_rows');
  }
  if (input.rows.length > BATCH_MAX_ROWS) {
    return refused('too_many_rows');
  }

  const technique = await findTechnique(db, input.orgId, input.techniqueId);
  if (!technique) {
    return refused(NOT_FOUND);
  }

  const runs = await runsCanvas(db, input);
  const first = nextRunRow(runs.ys);
  const workflowIds: string[] = [];
  const runIds: string[] = [];
  const mapping = input.mapping ?? autoMapping(technique.inputs.length, Math.max(...input.rows.map((r) => r.length)));
  for (const [i, row] of input.rows.entries()) {
    const values = batchRowValues(technique.inputs, mapping, row);
    const plan = withInputs(techniquePlan(technique, { x: 0, y: first + i * RUN_ROW_HEIGHT }), values);
    const written = await writePlan(db, { orgId: input.orgId, projectId: input.projectId, canvasId: runs.id, actor: input.actor }, plan);
    const generative = written.nodes.filter((n) => GENERATIVE_TYPES.has(n.type)).map((n) => n.id);
    const queued = await enqueueWorkflow(db, { orgId: input.orgId, projectId: input.projectId, canvasId: runs.id, nodeIds: generative, userId: input.userId, actor: input.actor });
    if (queued.kind === 'refused') {
      return refused(queued.error);
    }

    workflowIds.push(queued.workflowId);
    runIds.push(...Object.values(queued.runIdByNodeId));
  }

  return { outcome: 'queued', canvasId: runs.id, workflowIds, runIds };
}

export async function cancelRows(db: Db, input: { orgId: string; workflowIds: string[] }): Promise<{ cancelled: number }> {
  const outcomes = await Promise.all(input.workflowIds.map((workflowId) => cancelWorkflow(db, { orgId: input.orgId, workflowId })));
  return { cancelled: outcomes.reduce((total, o) => total + o.cancelled, 0) };
}

export async function rowsProgress(db: Db, input: { runIds: string[] }): Promise<RowsProgress> {
  const runs = await runsByIds(db, { ids: input.runIds });
  const count = (status: string) => runs.filter((r) => r.status === status).length;
  return { total: input.runIds.length, done: count('done'), failed: count('failed') + count('expired'), running: count('running') + count('finishing') };
}
