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

import { postCompositionFor, type PostCompositionNode } from './post-composition';
import { planWorkflow, type WorkflowEdge } from './workflow-plan';

export type SelectionActionId =
  | 'duplicate'
  | 'connect-new'
  | 'connect-existing'
  | 'promote'
  | 'run-workflow'
  | 'copy-id'
  | 'delete';

export type SelectionActionGroup = 'primary' | 'secondary' | 'overflow' | 'danger';

export type SelectionAction = {
  id: SelectionActionId;
  label: string;
  group: SelectionActionGroup;
  minNodes: number;
  keys?: string[];
};

export const SELECTION_ACTIONS: readonly SelectionAction[] = [
  { id: 'run-workflow', label: 'Run flow', group: 'primary', minNodes: 2 },
  { id: 'connect-new', label: 'Connect to new…', group: 'secondary', minNodes: 1 },
  { id: 'connect-existing', label: 'Connect to…', group: 'secondary', minNodes: 1 },
  { id: 'duplicate', label: 'Duplicate', group: 'secondary', minNodes: 1, keys: ['mod', 'D'] },
  { id: 'promote', label: 'Promote', group: 'secondary', minNodes: 1 },
  { id: 'copy-id', label: 'Copy id', group: 'overflow', minNodes: 1 },
  { id: 'delete', label: 'Delete', group: 'danger', minNodes: 1, keys: ['⌫'] }
];

export function actionsIn(group: SelectionActionGroup, count: number): SelectionAction[] {
  return SELECTION_ACTIONS.filter((a) => a.group === group && count >= a.minNodes);
}

export function enabledFor(
  id: SelectionActionId,
  nodeSummaries: PostCompositionNode[],
  edges: WorkflowEdge[] = []
): { enabled: boolean; reason?: string } {
  if (id === 'promote') {
    const composition = postCompositionFor(nodeSummaries);
    return {
      enabled: composition.enabled,
      reason: composition.enabled ? undefined : 'Select at least one media or text node'
    };
  }

  if (id === 'run-workflow') {
    const nodeTypesById = new Map(nodeSummaries.map((n) => [n.id, n.type]));
    const plan = planWorkflow(
      nodeSummaries.map((n) => n.id),
      edges,
      nodeTypesById
    );
    return { enabled: plan.ok, reason: plan.ok ? undefined : plan.reason };
  }

  return { enabled: true };
}
