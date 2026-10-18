/**
 * COSA SI PUÒ FARE A UNA SELEZIONE — una tabella, non un markup scritto a mano per ogni bottone.
 *
 * La barra che disegna questi bottoni (`SelectionToolbar.svelte`) non decide da sé quali mostrare
 * e in che ordine: legge questo elenco. Un'azione nuova — "Crea post dalla selezione", che arriva
 * dopo — è una riga qui, non un `{#if}` in più nel componente: lo stesso motivo per cui
 * `CANVAS_SHORTCUTS` esiste accanto a `matchCanvasShortcut`.
 *
 * `enabledFor` DICE SE L'AZIONE HA SENSO su QUESTA selezione, non se è "sempre visibile ma
 * spenta": duplicare e cancellare vanno bene su qualunque numero di nodi, ma collegare a un nodo
 * esistente ha bisogno di un bersaglio che non sia già nella selezione — quella domanda la fa
 * chi monta la barra, non questo file, perché richiede di sapere quali id esistono sulla tela.
 * Qui la tabella dice solo cosa un'azione È: un id, un'etichetta, quale scorciatoia la richiama
 * (se ne ha una — non tutte, "Connetti a…" resta senza perché ha bisogno di un secondo clic).
 */

import type { PostCompositionNode } from './post-composition';
import { FrameKind } from './motion-node';
import { Edge } from '$lib/motion/space';
import { GENERATIVE_TYPES, planWorkflow, type WorkflowEdge } from './workflow-plan';

export type SelectionActionId =
  | 'duplicate'
  | 'connect-new'
  | 'connect-existing'
  | 'run-workflow'
  | 'run-downstream'
  | 'run-stale'
  | 'copy-id'
  | 'report'
  | 'group'
  | 'ungroup'
  | 'copy'
  | 'paste'
  | 'bring-front'
  | 'send-back'
  | 'align-left'
  | 'align-center'
  | 'align-right'
  | 'align-top'
  | 'align-middle'
  | 'align-bottom'
  | 'tidy-up'
  | 'flip-horizontal'
  | 'flip-vertical'
  | 'use-as-mask'
  | 'release-mask'
  | 'create-formats'
  | 'export'
  | 'delete';

export type SelectionActionGroup = 'primary' | 'secondary' | 'overflow' | 'menu' | 'danger';

export type SelectionAction = {
  id: SelectionActionId;
  label: string;
  group: SelectionActionGroup;
  minNodes: number;
  shortcut?: string;
};

export const SELECTION_ACTIONS: readonly SelectionAction[] = [
  { id: 'run-workflow', label: 'Run flow', group: 'primary', minNodes: 2 },
  { id: 'run-downstream', label: 'Run from here', group: 'secondary', minNodes: 1 },
  { id: 'run-stale', label: 'Re-run out of date', group: 'secondary', minNodes: 1 },
  { id: 'connect-new', label: 'Connect to new…', group: 'secondary', minNodes: 1 },
  { id: 'connect-existing', label: 'Connect to…', group: 'secondary', minNodes: 1 },
  { id: 'duplicate', label: 'Duplicate', group: 'secondary', minNodes: 1, shortcut: 'Mod+D' },
  { id: 'group', label: 'Group', group: 'secondary', minNodes: 2, shortcut: 'Mod+G' },
  { id: 'ungroup', label: 'Ungroup', group: 'secondary', minNodes: 1, shortcut: 'Mod+Shift+G' },
  { id: 'copy', label: 'Copy', group: 'menu', minNodes: 1, shortcut: 'Mod+C' },
  { id: 'paste', label: 'Paste', group: 'menu', minNodes: 1, shortcut: 'Mod+V' },
  { id: 'bring-front', label: 'Bring to front', group: 'menu', minNodes: 1, shortcut: 'Mod+]' },
  { id: 'send-back', label: 'Send to back', group: 'menu', minNodes: 1, shortcut: 'Mod+[' },
  { id: 'align-left', label: 'Align left', group: 'menu', minNodes: 1, shortcut: 'Alt+A' },
  { id: 'align-center', label: 'Align horizontal centres', group: 'menu', minNodes: 1, shortcut: 'Alt+H' },
  { id: 'align-right', label: 'Align right', group: 'menu', minNodes: 1, shortcut: 'Alt+D' },
  { id: 'align-top', label: 'Align top', group: 'menu', minNodes: 1, shortcut: 'Alt+W' },
  { id: 'align-middle', label: 'Align vertical centres', group: 'menu', minNodes: 1, shortcut: 'Alt+V' },
  { id: 'align-bottom', label: 'Align bottom', group: 'menu', minNodes: 1, shortcut: 'Alt+S' },
  { id: 'tidy-up', label: 'Tidy up', group: 'menu', minNodes: 2, shortcut: 'Mod+Alt+T' },
  { id: 'flip-horizontal', label: 'Flip horizontal', group: 'menu', minNodes: 1, shortcut: 'Shift+H' },
  { id: 'flip-vertical', label: 'Flip vertical', group: 'menu', minNodes: 1, shortcut: 'Shift+V' },
  { id: 'use-as-mask', label: 'Use as mask', group: 'menu', minNodes: 1, shortcut: 'Mod+Ctrl+M' },
  { id: 'release-mask', label: 'Remove mask', group: 'menu', minNodes: 1 },
  { id: 'create-formats', label: 'Create formats…', group: 'menu', minNodes: 1 },
  { id: 'export', label: 'Export…', group: 'menu', minNodes: 1 },
  { id: 'copy-id', label: 'Copy id', group: 'overflow', minNodes: 1 },
  { id: 'report', label: 'Report content', group: 'overflow', minNodes: 1 },
  { id: 'delete', label: 'Delete', group: 'danger', minNodes: 1, shortcut: 'Backspace' }
];

export const ALIGN_EDGE = {
  'align-left': Edge.Left,
  'align-center': Edge.Center,
  'align-right': Edge.Right,
  'align-top': Edge.Top,
  'align-middle': Edge.Middle,
  'align-bottom': Edge.Bottom
} as const satisfies Partial<Record<SelectionActionId, Edge>>;

export type AlignActionId = keyof typeof ALIGN_EDGE;

export const ALIGN_ACTIONS = Object.keys(ALIGN_EDGE) as AlignActionId[];

const MENU_ORDER: readonly SelectionActionId[] = ['group', 'ungroup', 'duplicate', 'create-formats', 'export', 'copy', 'paste', 'bring-front', 'send-back', ...ALIGN_ACTIONS, 'tidy-up', 'flip-horizontal', 'flip-vertical', 'use-as-mask', 'release-mask', 'delete'];

export const CANVAS_MENU: readonly SelectionAction[] = MENU_ORDER.map((id) => SELECTION_ACTIONS.find((a) => a.id === id)!);

type Summary = { data: Record<string, unknown> };

const isGroup = (n: Summary) => n.data.kind === FrameKind.Group;

const isFrame = (n: Summary) => typeof n.data.format === 'string' && (n.data.kind ?? FrameKind.Frame) === FrameKind.Frame;

const SHOWN: Partial<Record<SelectionActionId, (summaries: readonly Summary[]) => boolean>> = {
  ungroup: (summaries) => summaries.some(isGroup),
  'create-formats': (summaries) => summaries.length === 1 && isFrame(summaries[0]),
  export: (summaries) => summaries.length > 0 && summaries.every(isFrame)
};

export function shownFor(id: SelectionActionId, summaries: readonly Summary[]): boolean {
  return SHOWN[id]?.(summaries) ?? true;
}

export type FrameOnlyActionId = 'flip-horizontal' | 'flip-vertical' | 'use-as-mask' | 'release-mask';

export type CanvasActionId = Exclude<SelectionActionId, FrameOnlyActionId>;

const FRAME_ONLY: ReadonlySet<SelectionActionId> = new Set<FrameOnlyActionId>(['flip-horizontal', 'flip-vertical', 'use-as-mask', 'release-mask']);

export const isCanvasAction = (id: SelectionActionId): id is CanvasActionId => !FRAME_ONLY.has(id);

const MIN_ALIGNED_TILES = 2;

export function canvasMenuIds(count: number): ReadonlySet<SelectionActionId> {
  const aligns = count >= MIN_ALIGNED_TILES;
  return new Set(MENU_ORDER.filter((id) => !FRAME_ONLY.has(id) && (aligns || !(id in ALIGN_EDGE))));
}

export function menuFor(available: ReadonlySet<SelectionActionId>, summaries: readonly Summary[]): SelectionAction[] {
  return CANVAS_MENU.filter((a) => available.has(a.id) && summaries.length >= a.minNodes && shownFor(a.id, summaries));
}

export function actionsIn(group: SelectionActionGroup, count: number): SelectionAction[] {
  return SELECTION_ACTIONS.filter((a) => a.group === group && count >= a.minNodes);
}

type Gate = { enabled: boolean; reason?: string };

type GateInput = { nodeSummaries: PostCompositionNode[]; edges: WorkflowEdge[]; stale: string[] };

const ALWAYS: Gate = { enabled: true };

const GATES: Partial<Record<SelectionActionId, (input: GateInput) => Gate>> = {
  'run-workflow': ({ nodeSummaries, edges }) => {
    const nodeTypesById = new Map(nodeSummaries.map((n) => [n.id, n.type]));
    const plan = planWorkflow(
      nodeSummaries.map((n) => n.id),
      edges,
      nodeTypesById
    );
    return { enabled: plan.ok, reason: plan.ok ? undefined : plan.reason };
  },
  'run-downstream': ({ nodeSummaries, edges }) => {
    const [only] = nodeSummaries;
    const runs = nodeSummaries.length === 1 && (GENERATIVE_TYPES.has(only.type) || edges.some((e) => e.sourceNodeId === only.id));
    return runs ? ALWAYS : { enabled: false, reason: 'Nothing runs from here' };
  },
  'run-stale': ({ nodeSummaries, stale }) =>
    nodeSummaries.some((n) => stale.includes(n.id)) ? ALWAYS : { enabled: false, reason: 'Nothing here is out of date' }
};

export function enabledFor(
  id: SelectionActionId,
  nodeSummaries: PostCompositionNode[],
  edges: WorkflowEdge[] = [],
  stale: string[] = []
): Gate {
  return GATES[id]?.({ nodeSummaries, edges, stale }) ?? ALWAYS;
}
