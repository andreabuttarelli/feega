import type { GenPropertyType } from '$lib/canvas/common-properties';
import type { ModelChoice } from '$lib/canvas/gen-node';
import type { SelectionPatch } from '$lib/canvas/node-controls';
import type { RunQuote } from '$lib/canvas/run-quote';
import type { SelectionActionId } from '$lib/canvas/selection-actions';
import type { Axis, Edge } from '$lib/motion/space';

export type NodeSummary = { id: string; type: string; data: Record<string, unknown> };

export type SelectionPanel = {
  summaries: NodeSummary[];
  choicesFor?: (type: GenPropertyType) => ModelChoice[];
  runQuote: RunQuote | null;
  onaction: (id: SelectionActionId) => void;
  onpropertychange: (patch: SelectionPatch & { model?: string | null }) => void;
  onview: () => void;
  onalign: (edge: Edge) => void;
  ondistribute: (axis: Axis) => void;
};

class SelectionProperties {
  panel = $state.raw<SelectionPanel | null>(null);

  publish(panel: SelectionPanel) {
    this.panel = panel;
  }

  clear() {
    this.panel = null;
  }
}

export const selectionProperties = new SelectionProperties();
