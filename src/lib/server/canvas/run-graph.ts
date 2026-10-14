import type { Db } from '$lib/server/db/client';
import { listConnections, listNodes, type CanvasNodeRecord } from '$lib/server/repos/canvas';
import { listNodeRuns } from '$lib/server/repos/node-runs';
import type { Actor } from '$lib/server/repos/actor';
import { GENERATIVE_TYPES, type WorkflowEdge, type WorkflowPlanResult } from '$lib/canvas/workflow-plan';
import { GraphScope, downstreamPlan, nodeOutputs, stalePlan, type NodeOutput } from '$lib/canvas/run-graph';
import type { GenMedium } from '$lib/canvas/gen-node';
import { enqueueSteps, estimateWorkflowCredits, type WorkflowEnqueueOutcome } from './workflow';

export { GraphScope };

export type GraphInput = {
  orgId: string;
  canvasId: string;
  graph: GraphScope;
  nodeId?: string;
  nodeIds?: string[];
};

export type GraphRunInput = GraphInput & { projectId: string; userId: string; actor?: Actor };

type CanvasGraph = { nodes: CanvasNodeRecord[]; edges: WorkflowEdge[]; outputs: NodeOutput[] };

const PLANNERS: Record<GraphScope, (graph: CanvasGraph, input: GraphInput) => WorkflowPlanResult> = {
  [GraphScope.Downstream]: (graph, input) =>
    downstreamPlan(input.nodeId ?? '', graph.edges, new Map(graph.nodes.map((n) => [n.id, n.type]))),
  [GraphScope.Stale]: (graph, input) => stalePlan(graph.outputs, graph.edges, input.nodeIds)
};

async function canvasGraph(db: Db, input: GraphInput): Promise<CanvasGraph> {
  const [nodes, connections] = await Promise.all([
    listNodes(db, { orgId: input.orgId, canvasId: input.canvasId }),
    listConnections(db, { orgId: input.orgId, canvasId: input.canvasId })
  ]);
  const edges = connections.map((c) => ({ sourceNodeId: c.sourceNodeId, targetNodeId: c.targetNodeId }));
  const read = input.graph === GraphScope.Stale ? nodes.filter((n) => GENERATIVE_TYPES.has(n.type)) : [];
  const runs = Object.fromEntries(await Promise.all(read.map(async (n) => [n.id, await listNodeRuns(db, { orgId: input.orgId, nodeId: n.id })] as const)));
  return { nodes, edges, outputs: nodeOutputs(nodes, runs) };
}

function creditsOf(plan: WorkflowPlanResult, nodesById: Map<string, CanvasNodeRecord>): number {
  if (!plan.ok) {
    return 0;
  }
  return estimateWorkflowCredits(
    plan.steps.map((step) => {
      const node = nodesById.get(step.nodeId);
      const medium = (node?.type === 'text' || node?.type === 'video' ? node.type : 'image') as GenMedium;
      return { medium, model: typeof node?.data.model === 'string' ? node.data.model : null };
    })
  );
}

async function planned(db: Db, input: GraphInput) {
  const graph = await canvasGraph(db, input);
  const plan = PLANNERS[input.graph](graph, input);
  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));
  return { plan, nodesById, credits: creditsOf(plan, nodesById) };
}

export async function planGraph(db: Db, input: GraphInput): Promise<{ plan: WorkflowPlanResult; credits: number }> {
  const { plan, credits } = await planned(db, input);
  return { plan, credits };
}

export async function enqueueGraph(db: Db, input: GraphRunInput): Promise<WorkflowEnqueueOutcome & { credits?: number }> {
  const { plan, nodesById, credits } = await planned(db, input);
  if (!plan.ok) {
    return { kind: 'refused', error: plan.reason };
  }
  return { ...(await enqueueSteps(db, input, plan.steps, nodesById)), credits };
}
