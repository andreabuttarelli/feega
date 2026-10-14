import { Viewport } from '$lib/motion/editor-layout';

export enum NodeMode {
  Preview = 'preview',
  Edit = 'edit'
}

export enum Opening {
  OnSelect = 'on-select',
  OnRequest = 'on-request'
}

const OPENING: Record<Viewport, Opening> = {
  [Viewport.Desktop]: Opening.OnSelect,
  [Viewport.Tablet]: Opening.OnSelect,
  [Viewport.Phone]: Opening.OnRequest
};

export const openingOf = (viewport: Viewport): Opening => OPENING[viewport];

type Row = { id: string; type: string };

export function inlineMotionTarget(selected: readonly string[], rows: readonly Row[], dismissed: string | null, opening: Opening, requested: string | null = null): string | null {
  if (selected.length !== 1 || selected[0] === dismissed) {
    return null;
  }
  if (opening === Opening.OnRequest && selected[0] !== requested) {
    return null;
  }
  return rows.find((r) => r.id === selected[0])?.type === 'motion' ? selected[0] : null;
}

export enum Paint {
  Pending = 'pending',
  Shown = 'shown',
  Swapped = 'swapped'
}

type Layers = { own: boolean; editor: boolean };

const LAYERS: Record<NodeMode, Record<Paint, Layers>> = {
  [NodeMode.Preview]: {
    [Paint.Pending]: { own: true, editor: false },
    [Paint.Shown]: { own: true, editor: false },
    [Paint.Swapped]: { own: true, editor: false }
  },
  [NodeMode.Edit]: {
    [Paint.Pending]: { own: true, editor: false },
    [Paint.Shown]: { own: true, editor: true },
    [Paint.Swapped]: { own: false, editor: true }
  }
};

export const nodeLayers = (mode: NodeMode, paint: Paint): Layers => LAYERS[mode][paint];

export enum Part {
  Body = 'body',
  Edges = 'edges',
  Label = 'label',
  Ports = 'ports'
}

export const NEIGHBOUR_WHILE_EDITING: Record<Part, number> = {
  [Part.Body]: 0.85,
  [Part.Edges]: 0.85,
  [Part.Label]: 0,
  [Part.Ports]: 0
};

export const neighbourStyle = () => Object.entries(NEIGHBOUR_WHILE_EDITING).map(([part, opacity]) => `--neighbour-${part}: ${opacity}`).join('; ');

export enum Reframe {
  Stay = 'stay',
  Frame = 'frame'
}

const REFRAME: Record<Viewport, Reframe> = {
  [Viewport.Desktop]: Reframe.Stay,
  [Viewport.Tablet]: Reframe.Frame,
  [Viewport.Phone]: Reframe.Frame
};

export const reframesOn = (viewport: Viewport): Reframe => REFRAME[viewport];

export enum CanvasState {
  Browsing = 'browsing',
  Editing = 'editing'
}
