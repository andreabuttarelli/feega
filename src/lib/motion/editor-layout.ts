import { z } from 'zod';

export enum Panel {
  Open = 'open',
  Closed = 'closed'
}

export enum Side {
  Chat = 'chat',
  Properties = 'properties'
}

export type EditorLayout = { chat: Panel; inspector: Panel; timelinePx: number; side: Side; sidePx: number };
export type LayoutStore = { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void };

export const TIMELINE_MIN_PX = 140;
export const SIDE_MIN_PX = 320;
export const SIDE_DEFAULT_PX = 400;
const SIDE_MAX_SHARE = 0.5;
const PREVIEW_MIN_PX = 160;
const STORAGE_KEY = 'motion-editor-layout';

export const DEFAULT_LAYOUT: EditorLayout = { chat: Panel.Open, inspector: Panel.Open, timelinePx: 360, side: Side.Chat, sidePx: SIDE_DEFAULT_PX };

const layoutSchema = z.object({ chat: z.enum(Panel), inspector: z.enum(Panel), timelinePx: z.number().finite(), side: z.enum(Side), sidePx: z.number().finite() });

export function readLayout(store: LayoutStore | null): EditorLayout {
  try {
    const parsed = layoutSchema.safeParse(JSON.parse(store?.getItem(STORAGE_KEY) ?? 'null'));
    return parsed.success ? parsed.data : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function writeLayout(store: LayoutStore | null, layout: EditorLayout): void {
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    return;
  }
}

export const flip = (panel: Panel): Panel => (panel === Panel.Open ? Panel.Closed : Panel.Open);

export function timelineHeight(px: number, room: number): number {
  return Math.max(TIMELINE_MIN_PX, Math.min(Math.round(px), room - PREVIEW_MIN_PX));
}

export function sideWidth(px: number, windowPx: number): number {
  return Math.max(SIDE_MIN_PX, Math.min(Math.round(px), Math.floor(windowPx * SIDE_MAX_SHARE)));
}

export function toggleSide(layout: EditorLayout, side: Side): EditorLayout {
  const open = layout.chat === Panel.Open || layout.inspector === Panel.Open;
  const panel = open && layout.side === side ? Panel.Closed : Panel.Open;
  return { ...layout, side, chat: panel, inspector: panel };
}

export enum Viewport {
  Phone = 'phone',
  Tablet = 'tablet',
  Desktop = 'desktop'
}

const VIEWPORT_FROM_PX: readonly (readonly [Viewport, number])[] = [
  [Viewport.Desktop, 1100],
  [Viewport.Tablet, 760],
  [Viewport.Phone, 0]
];

export const viewportOf = (width: number): Viewport => VIEWPORT_FROM_PX.find(([, from]) => width >= from)![0];

export enum ChatPlace {
  Column = 'column',
  Drawer = 'drawer',
  Sheet = 'sheet'
}

export const CHAT_PLACE: Record<Viewport, ChatPlace> = {
  [Viewport.Desktop]: ChatPlace.Column,
  [Viewport.Tablet]: ChatPlace.Drawer,
  [Viewport.Phone]: ChatPlace.Sheet
};
