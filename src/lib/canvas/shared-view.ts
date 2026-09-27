export type SharedView =
  | { kind: 'image'; url: string }
  | { kind: 'video'; url: string }
  | { kind: 'text'; text: string }
  | { kind: 'doc'; content: string }
  | { kind: 'frame'; url: string; html: string }
  | { kind: 'grid'; total: number; tiles: SharedTile[] }
  | { kind: 'list'; items: SharedListItem[] }
  | { kind: 'select'; index: number }
  | { kind: 'influencer'; name: string; summary: string | null; photo: string | null }
  | { kind: 'post'; caption: string; media: string[] }
  | { kind: 'ads'; query: string; country: string }
  | { kind: 'empty' };

export type SharedTile = {
  key: string;
  thumb: string | null;
  label: string;
  caption: string | null;
  badge: 'carousel' | 'video' | null;
};

export type SharedListItem = { label: string; text: string; url: string | null };

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
