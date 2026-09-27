export type SharedView =
  | { kind: 'image'; url: string }
  | { kind: 'video'; url: string }
  | { kind: 'text'; text: string }
  | { kind: 'doc'; content: string }
  | { kind: 'frame'; url: string; html: string }
  | { kind: 'empty' };

export type SharedNode = {
  id: string;
  type: string;
  displayName: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  view: SharedView;
};

export type SharedEdge = { id: string; source: string; target: string };

export type SharedCanvas = { name: string; nodes: SharedNode[]; edges: SharedEdge[] };

export enum ShareState {
  On = 'on',
  Off = 'off'
}
