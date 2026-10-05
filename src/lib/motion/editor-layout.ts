import { z } from 'zod';

export enum Panel {
  Open = 'open',
  Closed = 'closed'
}

export type EditorLayout = { chat: Panel; inspector: Panel; timelinePx: number };
export type LayoutStore = { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void };

export const TIMELINE_MIN_PX = 140;
const PREVIEW_MIN_PX = 160;
const STORAGE_KEY = 'motion-editor-layout';

export const DEFAULT_LAYOUT: EditorLayout = { chat: Panel.Open, inspector: Panel.Open, timelinePx: 300 };

const layoutSchema = z.object({ chat: z.enum(Panel), inspector: z.enum(Panel), timelinePx: z.number().finite() });

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
