import { GENERATIVE_TYPES, type WorkflowEdge, type WorkflowPlanResult, type WorkflowStep } from './workflow-plan';

export enum GraphScope {
  Downstream = 'downstream',
  Stale = 'stale'
}

export type NodeOutput = { id: string; type: string; lastDoneAt: string | null };

const CYCLE = 'The connections form a cycle';
const NOTHING_TO_RUN = 'Nothing to run';

function neighbours(edges: WorkflowEdge[], from: 'sourceNodeId' | 'targetNodeId', to: 'sourceNodeId' | 'targetNodeId') {
  const next = new Map<string, string[]>();
  for (const edge of edges) {
    next.set(edge[from], [...(next.get(edge[from]) ?? []), edge[to]]);
  }
  return next;
}

function reachableFrom(startId: string, next: Map<string, string[]>): string[] {
  const seen = new Set([startId]);
  const order = [startId];
  for (let i = 0; i < order.length; i += 1) {
    for (const id of next.get(order[i]) ?? []) {
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
      order.push(id);
    }
  }
  return order;
}

function nearestIn(id: string, members: Set<string>, parents: Map<string, string[]>): string[] {
  const found: string[] = [];
  const seen = new Set([id]);
  const queue = [...(parents.get(id) ?? [])];
  while (queue.length) {
    const current = queue.shift()!;
    if (seen.has(current)) {
      continue;
    }
    seen.add(current);
    if (members.has(current)) {
      found.push(current);
      continue;
    }
    queue.push(...(parents.get(current) ?? []));
  }
  return found;
}

function ordered(ids: string[], dependsOn: Map<string, string[]>): WorkflowStep[] | null {
  const remaining = new Set(ids);
  const steps: WorkflowStep[] = [];
  while (remaining.size) {
    const ready = [...remaining].filter((id) => dependsOn.get(id)!.every((dep) => !remaining.has(dep)));
    if (!ready.length) {
      return null;
    }
    for (const id of ready) {
      steps.push({ nodeId: id, dependsOn: dependsOn.get(id)! });
      remaining.delete(id);
    }
  }
  return steps;
}

function planOf(ids: string[], edges: WorkflowEdge[]): WorkflowPlanResult {
  if (!ids.length) {
    return { ok: false, reason: NOTHING_TO_RUN };
  }
  const members = new Set(ids);
  const parents = neighbours(edges, 'targetNodeId', 'sourceNodeId');
  const dependsOn = new Map(ids.map((id) => [id, nearestIn(id, members, parents)]));
  const steps = ordered(ids, dependsOn);
  return steps ? { ok: true, steps } : { ok: false, reason: CYCLE };
}

export function downstreamPlan(startId: string, edges: WorkflowEdge[], typesById: Map<string, string>): WorkflowPlanResult {
  const below = reachableFrom(startId, neighbours(edges, 'sourceNodeId', 'targetNodeId'));
  return planOf(below.filter((id) => GENERATIVE_TYPES.has(typesById.get(id) ?? '')), edges);
}

export function staleIds(nodes: NodeOutput[], edges: WorkflowEdge[]): string[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const parents = neighbours(edges, 'targetNodeId', 'sourceNodeId');
  const generative = new Set(nodes.filter((n) => GENERATIVE_TYPES.has(n.type)).map((n) => n.id));
  const memo = new Map<string, boolean>();

  const isStale = (id: string): boolean => {
    if (memo.has(id)) {
      return memo.get(id)!;
    }
    memo.set(id, false);
    const own = byId.get(id)?.lastDoneAt ?? null;
    const stale =
      own !== null &&
      nearestIn(id, generative, parents).some((input) => {
        const theirs = byId.get(input)?.lastDoneAt ?? null;
        return (theirs !== null && theirs > own) || isStale(input);
      });
    memo.set(id, stale);
    return stale;
  };

  return nodes.filter((n) => generative.has(n.id) && isStale(n.id)).map((n) => n.id);
}

type RunRow = { id?: string; status?: string; startedAt?: string; finishedAt?: string | null; costUsd?: number | null };

export type RunListing = { id: string; nodeId: string; name: string; status: string; startedAt: string; costUsd: number | null };

export function nodeOutputs(nodes: { id: string; type: string }[], runs: Record<string, RunRow[]>): NodeOutput[] {
  return nodes.map((n) => {
    const done = (runs[n.id] ?? []).filter((r) => r.status === 'done' && r.finishedAt).map((r) => r.finishedAt!);
    return { id: n.id, type: n.type, lastDoneAt: done.sort().at(-1) ?? null };
  });
}

export function recentRuns(runs: Record<string, RunRow[]>, names: Map<string, string>, limit: number): RunListing[] {
  return Object.entries(runs)
    .flatMap(([nodeId, rows]) =>
      rows.map((r) => ({
        id: r.id ?? '',
        nodeId,
        name: names.get(nodeId) ?? nodeId,
        status: r.status ?? '',
        startedAt: r.startedAt ?? '',
        costUsd: r.costUsd ?? null
      }))
    )
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, limit);
}

export function stalePlan(nodes: NodeOutput[], edges: WorkflowEdge[], within?: string[]): WorkflowPlanResult {
  const stale = staleIds(nodes, edges);
  return planOf(within ? stale.filter((id) => within.includes(id)) : stale, edges);
}
