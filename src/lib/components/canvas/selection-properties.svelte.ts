import type { GenPropertyType } from '$lib/canvas/common-properties';
import type { ModelChoice } from '$lib/canvas/gen-node';
import type { SelectionPatch } from '$lib/canvas/node-controls';
import type { RunQuote } from '$lib/canvas/run-quote';
import type { Axis, Edge } from '$lib/motion/space';
import type { Placed } from '$lib/canvas/node-layout';
import type { BoxField } from '$lib/canvas/selection-box';

export type NodeSummary = { id: string; type: string; data: Record<string, unknown> };

export type SelectionBox = { items: Placed[]; set: (field: BoxField, value: number) => void };

export type SelectionPanel = {
  summaries: NodeSummary[];
  choicesFor?: (type: GenPropertyType) => ModelChoice[];
  runQuote: RunQuote | null;
  onpropertychange: (patch: SelectionPatch & { model?: string | null }) => void;
  onalign: (edge: Edge) => void;
  ondistribute: (axis: Axis) => void;
  box?: SelectionBox | null;
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
