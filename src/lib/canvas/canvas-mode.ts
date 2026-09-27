import { SelectionMode } from '@xyflow/svelte';

export enum CanvasMode {
  Edit = 'edit',
  View = 'view'
}

type FlowFlags = {
  nodesDraggable: boolean;
  nodesConnectable: boolean;
  elementsSelectable: boolean;
  selectionOnDrag: boolean;
  selectionMode: SelectionMode;
  panOnDrag: boolean | number[];
  panOnScroll: boolean;
  zoomOnScroll: boolean;
  zoomOnPinch: boolean;
  zoomOnDoubleClick: boolean;
  deleteKey: null;
};

export type CanvasModeSpec = { flow: FlowFlags; chrome: boolean };

export const CANVAS_MODES: Record<CanvasMode, CanvasModeSpec> = {
  [CanvasMode.Edit]: {
    flow: {
      nodesDraggable: true,
      nodesConnectable: true,
      elementsSelectable: true,
      selectionOnDrag: true,
      selectionMode: SelectionMode.Partial,
      panOnDrag: [1, 2],
      panOnScroll: true,
      zoomOnScroll: false,
      zoomOnPinch: true,
      zoomOnDoubleClick: false,
      deleteKey: null
    },
    chrome: true
  },
  [CanvasMode.View]: {
    flow: {
      nodesDraggable: false,
      nodesConnectable: false,
      elementsSelectable: false,
      selectionOnDrag: false,
      selectionMode: SelectionMode.Partial,
      panOnDrag: true,
      panOnScroll: false,
      zoomOnScroll: true,
      zoomOnPinch: true,
      zoomOnDoubleClick: false,
      deleteKey: null
    },
    chrome: false
  }
};
