import { can, OrgAction, type OrgRole } from '$lib/org-roles';

export enum CanvasMode {
  Edit = 'edit',
  View = 'view'
}

type FlowFlags = {
  nodesDraggable: boolean;
  nodesConnectable: boolean;
  elementsSelectable: boolean;
  panOnScroll: boolean;
};

export type CanvasModeSpec = { flow: FlowFlags; chrome: boolean };

export const CANVAS_MODES: Record<CanvasMode, CanvasModeSpec> = {
  [CanvasMode.Edit]: {
    flow: {
      nodesDraggable: true,
      nodesConnectable: true,
      elementsSelectable: true,
      panOnScroll: true
    },
    chrome: true
  },
  [CanvasMode.View]: {
    flow: {
      nodesDraggable: false,
      nodesConnectable: false,
      elementsSelectable: false,
      panOnScroll: false
    },
    chrome: false
  }
};

export function canvasModeFor(role: OrgRole): CanvasMode {
  return can(role, OrgAction.Edit) ? CanvasMode.Edit : CanvasMode.View;
}
