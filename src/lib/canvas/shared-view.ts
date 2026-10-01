import type { OutputPort } from './select-sources';
import type { CalendarView } from '$lib/calendar/period-grid';

export type SharedView =
  | { kind: 'image'; url: string }
  | { kind: 'video'; url: string }
  | { kind: 'audio'; videoUrl: string | null; audioUrl: string | null }
  | { kind: 'text'; text: string }
  | { kind: 'doc'; content: string }
  | { kind: 'frame'; url: string; html: string }
  | { kind: 'grid'; total: number; tiles: SharedTile[] }
  | { kind: 'list'; items: SharedListItem[] }
  | { kind: 'select'; index: number; outputs: SharedOutput[] }
  | { kind: 'influencer'; name: string; summary: string | null; photo: string | null }
  | { kind: 'post'; caption: string; media: string[] }
  | { kind: 'ads'; query: string; country: string }
  | { kind: 'calendar'; view: CalendarView; anchor: string }
  | { kind: 'empty' };

export type SharedTile = {
  key: string;
  thumb: string | null;
  label: string;
  caption: string | null;
  badge: 'carousel' | 'video' | null;
  sale?: string | null;
};

export type SharedOutput = { label: string; port: OutputPort; incompatible: boolean };

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
