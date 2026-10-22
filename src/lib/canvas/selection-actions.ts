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
import { FRAME_DIALOG_ACTIONS, isFrameDialogAction, type FrameDialogActionId } from './frame-dialogs';
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
  | 'select-matching'
  | 'frame-selection'
  | 'auto-layout'
  | 'union'
  | 'subtract'
  | 'intersect'
  | 'exclude'
  | 'flatten'
  | 'outline-stroke'
  | 'outline-text'
  | 'create-formats'
  | 'export'
  | 'delete'
  | FrameDialogActionId;

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
  { id: 'select-matching', label: 'Select matching layers', group: 'menu', minNodes: 1, shortcut: 'Mod+Alt+A' },
  { id: 'frame-selection', label: 'Frame selection', group: 'menu', minNodes: 1, shortcut: 'Mod+Alt+G' },
  { id: 'auto-layout', label: 'Add auto layout', group: 'menu', minNodes: 1, shortcut: 'Shift+A' },
  { id: 'union', label: 'Union', group: 'menu', minNodes: 2, shortcut: 'Alt+Shift+U' },
  { id: 'subtract', label: 'Subtract', group: 'menu', minNodes: 2, shortcut: 'Alt+Shift+S' },
  { id: 'intersect', label: 'Intersect', group: 'menu', minNodes: 2, shortcut: 'Alt+Shift+I' },
  { id: 'exclude', label: 'Exclude', group: 'menu', minNodes: 2, shortcut: 'Alt+Shift+E' },
  { id: 'flatten', label: 'Flatten', group: 'menu', minNodes: 1, shortcut: 'Mod+E' },
  { id: 'outline-stroke', label: 'Outline stroke', group: 'menu', minNodes: 1, shortcut: 'Mod+Alt+O' },
  { id: 'outline-text', label: 'Outline text', group: 'menu', minNodes: 1, shortcut: 'Mod+Shift+O' },
  { id: 'create-formats', label: 'Create formats…', group: 'menu', minNodes: 1 },
  { id: 'export', label: 'Export…', group: 'overflow', minNodes: 1 },
  { id: 'frame-voice', label: 'Add voice-over…', group: 'overflow', minNodes: 1 },
  { id: 'frame-music', label: 'Add music…', group: 'overflow', minNodes: 1 },
  { id: 'frame-interactive', label: 'Interactive…', group: 'overflow', minNodes: 1 },
  { id: 'frame-components', label: 'Components…', group: 'overflow', minNodes: 1 },
  { id: 'frame-templates', label: 'Templates…', group: 'overflow', minNodes: 1 },
  { id: 'frame-branches', label: 'Branches…', group: 'overflow', minNodes: 1 },
  { id: 'frame-history', label: 'Version history…', group: 'overflow', minNodes: 1 },
  { id: 'frame-chat', label: 'Chat history…', group: 'overflow', minNodes: 1 },
  { id: 'frame-save-template', label: 'Save as template…', group: 'overflow', minNodes: 1 },
  { id: 'frame-publish', label: 'Publish to gallery…', group: 'overflow', minNodes: 1 },
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

const MENU_ORDER: readonly SelectionActionId[] = ['group', 'ungroup', 'duplicate', 'create-formats', 'export', 'copy', 'paste', 'bring-front', 'send-back', ...ALIGN_ACTIONS, 'tidy-up', 'flip-horizontal', 'flip-vertical', 'use-as-mask', 'release-mask', 'select-matching', 'frame-selection', 'auto-layout', 'union', 'subtract', 'intersect', 'exclude', 'flatten', 'outline-stroke', 'outline-text', 'delete'];

export const CANVAS_MENU: readonly SelectionAction[] = MENU_ORDER.map((id) => SELECTION_ACTIONS.find((a) => a.id === id)!);

type Summary = { data: Record<string, unknown> };

const isGroup = (n: Summary) => n.data.kind === FrameKind.Group;

const isDrawn = (n: Summary) => typeof n.data.format === 'string' && n.data.kind !== FrameKind.Group;

const isFrame = (n: Summary) => typeof n.data.format === 'string' && (n.data.kind ?? FrameKind.Frame) === FrameKind.Frame;

const isOneFrame = (summaries: readonly Summary[]) => summaries.length === 1 && isFrame(summaries[0]);

const FRAME_DIALOG_SHOWN = Object.fromEntries((Object.keys(FRAME_DIALOG_ACTIONS) as FrameDialogActionId[]).map((id) => [id, isOneFrame]));

const SHOWN: Partial<Record<SelectionActionId, (summaries: readonly Summary[]) => boolean>> = {
  ...FRAME_DIALOG_SHOWN,
  ungroup: (summaries) => summaries.some(isGroup),
  'create-formats': (summaries) => summaries.length === 1 && isFrame(summaries[0]),
  export: (summaries) => summaries.length > 0 && summaries.every(isDrawn)
};

export function shownFor(id: SelectionActionId, summaries: readonly Summary[]): boolean {
  return SHOWN[id]?.(summaries) ?? true;
}

export type FrameOnlyActionId = 'flip-horizontal' | 'flip-vertical' | 'use-as-mask' | 'release-mask' | 'select-matching' | 'frame-selection' | 'auto-layout' | 'union' | 'subtract' | 'intersect' | 'exclude' | 'flatten' | 'outline-stroke' | 'outline-text';

export type CanvasActionId = Exclude<SelectionActionId, FrameOnlyActionId | FrameDialogActionId>;

const FRAME_ONLY: ReadonlySet<SelectionActionId> = new Set<FrameOnlyActionId>(['flip-horizontal', 'flip-vertical', 'use-as-mask', 'release-mask', 'select-matching', 'frame-selection', 'auto-layout', 'union', 'subtract', 'intersect', 'exclude', 'flatten', 'outline-stroke', 'outline-text']);

export const isCanvasAction = (id: SelectionActionId): id is CanvasActionId => !FRAME_ONLY.has(id) && !isFrameDialogAction(id);

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
