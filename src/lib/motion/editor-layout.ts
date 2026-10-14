import { z } from 'zod';
import { Detent } from './sheet-detents';

export enum Panel {
  Open = 'open',
  Closed = 'closed'
}

export enum Side {
  Chat = 'chat',
  Properties = 'properties'
}

export type EditorLayout = { chat: Panel; inspector: Panel; timeline: Panel; timelinePx: number; side: Side; sidePx: number };
export type LayoutStore = { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void };

export const TIMELINE_MIN_PX = 140;
export const SIDE_MIN_PX = 320;
export const SIDE_DEFAULT_PX = 400;
const SIDE_MAX_SHARE = 0.5;
const PREVIEW_MIN_PX = 160;
const STORAGE_KEY = 'motion-editor-layout';

export const DEFAULT_LAYOUT: EditorLayout = { chat: Panel.Open, inspector: Panel.Open, timeline: Panel.Open, timelinePx: 210, side: Side.Chat, sidePx: SIDE_DEFAULT_PX };

const layoutSchema = z.object({ chat: z.enum(Panel), inspector: z.enum(Panel), timeline: z.enum(Panel).default(Panel.Open), timelinePx: z.number().finite(), side: z.enum(Side), sidePx: z.number().finite() });

export function readLayout(store: LayoutStore | null, fallback: EditorLayout = DEFAULT_LAYOUT): EditorLayout {
  try {
    const parsed = layoutSchema.safeParse(JSON.parse(store?.getItem(STORAGE_KEY) ?? 'null'));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
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

export const toggleTimeline = (layout: EditorLayout): EditorLayout => ({ ...layout, timeline: flip(layout.timeline) });

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

const TIMELINE_DEFAULT_PX: Record<Viewport, number> = {
  [Viewport.Desktop]: 210,
  [Viewport.Tablet]: 180,
  [Viewport.Phone]: 180
};

const TIMELINE_SCREEN_SHARE: Record<Viewport, number> = {
  [Viewport.Desktop]: 1,
  [Viewport.Tablet]: 1,
  [Viewport.Phone]: 0.3
};

export const defaultTimelinePx = (viewport: Viewport, screenPx: number): number =>
  Math.max(TIMELINE_MIN_PX, Math.min(TIMELINE_DEFAULT_PX[viewport], Math.floor(screenPx * TIMELINE_SCREEN_SHARE[viewport])));

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

export enum Transport {
  Shown = 'shown',
  Hidden = 'hidden'
}

const PHONE_TRANSPORT_UNDER_AGENT: Record<Detent, Transport> = {
  [Detent.Peek]: Transport.Shown,
  [Detent.Half]: Transport.Hidden,
  [Detent.Full]: Transport.Hidden
};

export const transportOf = (viewport: Viewport, agent: Detent | null): Transport =>
  viewport === Viewport.Phone && agent ? PHONE_TRANSPORT_UNDER_AGENT[agent] : Transport.Shown;

const PHONE_TABS_PX = 56;
const PHONE_TRANSPORT_PX = 64;

export const sheetFloor = (transport: Transport): number => PHONE_TABS_PX + (transport === Transport.Shown ? PHONE_TRANSPORT_PX : 0);
