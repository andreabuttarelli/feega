import type { CanvasNodeRecord } from '$lib/server/repos/canvas';
import { DropOn } from '$lib/motion/move-element';
import { SECTION_DEFAULT_FILL } from './node-data';
import { layoutOf } from './node-layout';
import { cleanNodeName } from './node-name';
import { groupedLocally, ungroupedLocally } from './optimistic-group';
import { restoreRows, type OptimisticOp, type Touched } from './optimistic-ops';
import { SECTION_TYPE, sectionBoxAround } from './section';
import { stackedLocally, type Stack } from './stacking';
import type { UndoItem } from './undo-plan';

export type OptTile = { id: string; type: string; displayName: string | null; x: number; y: number; w: number; h: number; data: Record<string, unknown>; version: number; select?: boolean };
export type OptEdge = { id: string; source: string; target: string; mode?: string };
export type CanvasRows<N extends OptTile, E extends OptEdge> = { nodes: N[]; edges: E[] };
export type RowContext<N> = { toTile: (record: CanvasNodeRecord) => N };
export type Answer = Record<string, unknown>;
export type Post = (action: string, fields: Record<string, string>) => Promise<Answer | null>;

export enum OptimisticAction {
  MoveFree = 'moveFree',
  Stack = 'stackElements',
  Section = 'wrapSection',
  Group = 'groupElements',
  Ungroup = 'ungroupElement',
  Restack = 'restack',
  Rename = 'rename',
  EdgeMode = 'set_edge_mode',
  Remove = 'remove'
}

export enum Landing {
  Moved = 'moved',
  Answered = 'answered'
}

export enum Refresh {
  AfterIdle = 'after-idle',
  None = 'none'
}

type Inputs = {
  [OptimisticAction.MoveFree]: { id: string; frameId: string; at: { x: number; y: number } };
  [OptimisticAction.Stack]: { ids: string[]; id: string };
  [OptimisticAction.Section]: { ids: string[]; id: string };
  [OptimisticAction.Group]: { ids: string[]; id: string };
  [OptimisticAction.Ungroup]: { id: string };
  [OptimisticAction.Restack]: { ids: string[]; to: Stack };
  [OptimisticAction.Rename]: { id: string; name: string };
  [OptimisticAction.EdgeMode]: { connectionId: string; mode: string };
  [OptimisticAction.Remove]: { nodeIds: string[]; edgeIds: string[] };
};

type Rows = CanvasRows<OptTile, OptEdge>;

type Row<I> = {
  fields: (input: I) => Record<string, string>;
  apply: <N extends OptTile, E extends OptEdge>(rows: CanvasRows<N, E>, input: I, ctx: RowContext<N>) => CanvasRows<N, E>;
  touched: (input: I, rows: Rows) => Touched;
  landing: Landing;
  undo: (answer: Answer, before: Rows, input: I) => UndoItem[];
  refresh: Refresh;
  notice: string;
};

const SECTION_TITLE = 'Section';
const MOVED_DONE = 'done';

const nodesOnly = (ids: readonly string[]): Touched => ({ nodes: ids, edges: [] });
const serverUndo = (answer: Answer): UndoItem[] => (answer.undo ?? []) as UndoItem[];
const noUndo = (): UndoItem[] => [];
const idsField = (input: { ids: string[]; id: string }) => ({ ids: JSON.stringify(input.ids), node_id: input.id });

function sectionRecord(id: string, picked: readonly OptTile[]): CanvasNodeRecord {
  const box = sectionBoxAround(picked.map((t) => ({ left: t.x, top: t.y, width: t.w, height: t.h })));
  return {
    id,
    canvasId: '',
    projectId: '',
    type: SECTION_TYPE,
    displayName: null,
    position: { x: box.left, y: box.top, z: 0 },
    size: { width: box.width, height: box.height },
    data: { title: SECTION_TITLE, fill: SECTION_DEFAULT_FILL },
    version: 0
  };
}

function joined<N extends OptTile>(nodes: N[], ids: readonly string[], groupId: string): N[] {
  const wanted = new Set(ids);
  return nodes.map((n) => (wanted.has(n.id) ? { ...n, data: { ...n.data, groupId } } : n));
}

function removedUndo(before: Rows, input: Inputs[OptimisticAction.Remove]): UndoItem[] {
  const edges = before.edges.filter((e) => input.edgeIds.includes(e.id));
  const nodes = before.nodes.filter((n) => input.nodeIds.includes(n.id));
  return [
    ...edges.map((e): UndoItem => ({ kind: 'edge.delete', edgeId: e.id, sourceNodeId: e.source, targetNodeId: e.target })),
    ...nodes.map((n): UndoItem => ({
      kind: 'node.delete',
      nodeId: n.id,
      before: { type: n.type, position: { x: n.x, y: n.y, z: 0 }, size: { width: n.w, height: n.h }, data: n.data, version: n.version }
    }))
  ];
}

const REGISTRY: { [K in OptimisticAction]: Row<Inputs[K]> } = {
  [OptimisticAction.MoveFree]: {
    fields: (i) => ({ source: i.id, drop: JSON.stringify({ on: DropOn.Frame, nodeId: i.frameId, at: i.at }) }),
    apply: (rows, i) => ({ ...rows, nodes: rows.nodes.filter((n) => n.id !== i.id) }),
    touched: (i) => nodesOnly([i.id]),
    landing: Landing.Moved,
    undo: serverUndo,
    refresh: Refresh.AfterIdle,
    notice: 'Moving into the frame did not save and was undone.'
  },
  [OptimisticAction.Stack]: {
    fields: idsField,
    apply: (rows, i, ctx) => ({ ...rows, nodes: groupedLocally(rows.nodes, i.ids, i.id, ctx.toTile) }),
    touched: (i) => nodesOnly([...i.ids, i.id]),
    landing: Landing.Moved,
    undo: serverUndo,
    refresh: Refresh.AfterIdle,
    notice: 'Wrap with stack did not save and was undone.'
  },
  [OptimisticAction.Section]: {
    fields: idsField,
    apply: (rows, i, ctx) => {
      const picked = rows.nodes.filter((n) => i.ids.includes(n.id));
      return picked.length ? { ...rows, nodes: [ctx.toTile(sectionRecord(i.id, picked)), ...joined(rows.nodes, i.ids, i.id)] } : rows;
    },
    touched: (i) => nodesOnly([...i.ids, i.id]),
    landing: Landing.Moved,
    undo: serverUndo,
    refresh: Refresh.AfterIdle,
    notice: 'The section did not save and was undone.'
  },
  [OptimisticAction.Group]: {
    fields: idsField,
    apply: (rows, i, ctx) => ({ ...rows, nodes: groupedLocally(rows.nodes, i.ids, i.id, ctx.toTile) }),
    touched: (i) => nodesOnly([...i.ids, i.id]),
    landing: Landing.Moved,
    undo: serverUndo,
    refresh: Refresh.AfterIdle,
    notice: 'The group did not save and was undone.'
  },
  [OptimisticAction.Ungroup]: {
    fields: (i) => ({ id: i.id }),
    apply: (rows, i) => ({ ...rows, nodes: ungroupedLocally(rows.nodes, i.id) }),
    touched: (i, rows) => nodesOnly([i.id, ...rows.nodes.filter((n) => layoutOf(n.data).groupId === i.id).map((n) => n.id)]),
    landing: Landing.Moved,
    undo: serverUndo,
    refresh: Refresh.AfterIdle,
    notice: 'Ungroup did not save and was undone.'
  },
  [OptimisticAction.Restack]: {
    fields: (i) => ({ ids: JSON.stringify(i.ids), to: i.to }),
    apply: (rows, i) => ({ ...rows, nodes: stackedLocally(rows.nodes, i.ids, i.to) }),
    touched: (i) => nodesOnly(i.ids),
    landing: Landing.Answered,
    undo: noUndo,
    refresh: Refresh.None,
    notice: 'The new order did not save and was undone.'
  },
  [OptimisticAction.Rename]: {
    fields: (i) => ({ node_id: i.id, name: i.name }),
    apply: (rows, i) => ({ ...rows, nodes: rows.nodes.map((n) => (n.id === i.id ? { ...n, displayName: cleanNodeName(i.name) } : n)) }),
    touched: (i) => nodesOnly([i.id]),
    landing: Landing.Answered,
    undo: noUndo,
    refresh: Refresh.None,
    notice: 'The new name did not save and was undone.'
  },
  [OptimisticAction.EdgeMode]: {
    fields: (i) => ({ connection_id: i.connectionId, mode: i.mode }),
    apply: (rows, i) => ({ ...rows, edges: rows.edges.map((e) => (e.id === i.connectionId ? ({ ...e, mode: i.mode } as typeof e) : e)) }),
    touched: (i) => ({ nodes: [], edges: [i.connectionId] }),
    landing: Landing.Answered,
    undo: noUndo,
    refresh: Refresh.None,
    notice: 'The wire mode did not save and was undone.'
  },
  [OptimisticAction.Remove]: {
    fields: (i) => ({ node_ids: i.nodeIds.join(','), connection_ids: i.edgeIds.join(',') }),
    apply: (rows, i) => ({ nodes: rows.nodes.filter((n) => !i.nodeIds.includes(n.id)), edges: rows.edges.filter((e) => !i.edgeIds.includes(e.id)) }),
    touched: (i) => ({ nodes: i.nodeIds, edges: i.edgeIds }),
    landing: Landing.Answered,
    undo: (_, before, i) => removedUndo(before, i),
    refresh: Refresh.None,
    notice: 'Delete did not save; the items are back.'
  }
};

const LANDED: Record<Landing, (answer: Answer) => boolean> = {
  [Landing.Moved]: (answer) => answer.outcome === MOVED_DONE,
  [Landing.Answered]: () => true
};

export const refreshOf = (action: OptimisticAction): Refresh => REGISTRY[action].refresh;

export function restoreCanvas<N extends OptTile, E extends OptEdge>(current: CanvasRows<N, E>, before: CanvasRows<N, E>, touched: Touched): CanvasRows<N, E> {
  return { nodes: restoreRows(current.nodes, before.nodes, touched.nodes), edges: restoreRows(current.edges, before.edges, touched.edges) };
}

export function optimisticOp<K extends OptimisticAction, N extends OptTile, E extends OptEdge>(
  action: K,
  input: Inputs[K],
  before: CanvasRows<N, E>,
  ctx: RowContext<N>,
  post: Post
): OptimisticOp<CanvasRows<N, E>, Answer> {
  const row = REGISTRY[action] as Row<Inputs[K]>;
  return {
    apply: (rows) => row.apply(rows, input, ctx),
    touched: row.touched(input, before),
    send: async () => {
      const answer = await post(action, row.fields(input));
      return answer && LANDED[row.landing](answer) ? answer : null;
    },
    undo: (answer) => row.undo(answer, before, input),
    notice: row.notice
  };
}
