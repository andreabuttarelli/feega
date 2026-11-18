import { DrawTool } from '$lib/motion/draw-tool';
import { EditorMode } from './editor-mode.svelte';

export enum BarContext {
  Canvas = 'canvas',
  Frame = 'frame'
}

export enum BarSlot {
  Select = 'select',
  Draw = 'draw',
  Insert = 'insert',
  Comment = 'comment'
}

export enum BarWidth {
  Wide = 'wide',
  Compact = 'compact'
}

export const BAR_COMPACT_QUERY = '(max-width: 1040px)';

export const PINNED_TOOLS: readonly DrawTool[] = [DrawTool.Rectangle, DrawTool.Ellipse, DrawTool.Text, DrawTool.Pen, DrawTool.Frame];

export const BAR_SLOTS: readonly BarSlot[] = [BarSlot.Select, BarSlot.Draw, BarSlot.Insert, BarSlot.Comment];

const ALL_SLOTS: ReadonlySet<BarSlot> = new Set(BAR_SLOTS);
const READ_ONLY_HIDDEN: readonly BarSlot[] = [BarSlot.Draw];

export const MODE_SLOTS: Record<EditorMode, ReadonlySet<BarSlot>> = {
  [EditorMode.Design]: ALL_SLOTS,
  [EditorMode.Motion]: ALL_SLOTS,
  [EditorMode.Play]: new Set(BAR_SLOTS.filter((s) => !READ_ONLY_HIDDEN.includes(s))),
  [EditorMode.Code]: new Set(BAR_SLOTS.filter((s) => !READ_ONLY_HIDDEN.includes(s)))
};

const COMPACT_HIDDEN: ReadonlySet<BarSlot> = new Set(READ_ONLY_HIDDEN);

const WIDTH_SLOTS: Record<BarWidth, (slot: BarSlot) => boolean> = {
  [BarWidth.Wide]: () => true,
  [BarWidth.Compact]: (slot) => !COMPACT_HIDDEN.has(slot)
};

export const barSlots = (mode: EditorMode, width: BarWidth): BarSlot[] => BAR_SLOTS.filter((slot) => MODE_SLOTS[mode].has(slot) && WIDTH_SLOTS[width](slot));

export const barContextFor = (selectedFrame: string | null): BarContext => (selectedFrame ? BarContext.Frame : BarContext.Canvas);
