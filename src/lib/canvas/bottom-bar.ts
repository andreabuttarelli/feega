import { CanvasState } from './inline-motion';
import { Region } from './key-region.svelte';

export enum BarContext {
  Canvas = 'canvas',
  Frame = 'frame'
}

export enum BarMode {
  Design = 'design',
  Generate = 'generate'
}

export enum BarSlot {
  Mode = 'mode',
  Select = 'select',
  Generate = 'generate',
  Upload = 'upload',
  More = 'more',
  Templates = 'templates',
  FrameTemplates = 'frame-templates',
  Draw = 'draw',
  Image = 'image',
  FrameLibrary = 'frame-library'
}

type ContextRules = { slots: Record<BarMode, readonly BarSlot[]>; followsTimeline: boolean; keys: Region; yieldsToDialogs: boolean };

const FRAME_TOOLS: readonly BarSlot[] = [BarSlot.Draw, BarSlot.Image, BarSlot.FrameLibrary];

const CONTEXT: Record<BarContext, ContextRules> = {
  [BarContext.Canvas]: {
    slots: {
      [BarMode.Design]: [BarSlot.Mode, BarSlot.Draw, BarSlot.Upload, BarSlot.FrameTemplates],
      [BarMode.Generate]: [BarSlot.Mode, BarSlot.Select, BarSlot.Generate, BarSlot.More, BarSlot.Templates, BarSlot.FrameTemplates]
    },
    followsTimeline: false,
    keys: Region.Canvas,
    yieldsToDialogs: false
  },
  [BarContext.Frame]: { slots: { [BarMode.Design]: FRAME_TOOLS, [BarMode.Generate]: FRAME_TOOLS }, followsTimeline: true, keys: Region.Editor, yieldsToDialogs: true }
};

export const barSlots = (context: BarContext, mode: BarMode): readonly BarSlot[] => CONTEXT[context].slots[mode];

export const BAR_MODE_KEY = 'feega:canvas-bar-mode';

const MODES = new Set<string>(Object.values(BarMode));

export const readBarMode = (stored: string | null): BarMode => (stored && MODES.has(stored) ? (stored as BarMode) : BarMode.Generate);

const STATE_CONTEXT: Record<CanvasState, BarContext> = {
  [CanvasState.Browsing]: BarContext.Canvas,
  [CanvasState.Editing]: BarContext.Frame
};

export const barContextOf = (state: CanvasState): BarContext => STATE_CONTEXT[state];

export const barLift = (context: BarContext, timelinePx: number): number => (CONTEXT[context].followsTimeline ? timelinePx : 0);

const HALF = 2;

export const barShift = (context: BarContext, sidePx: number): number => (CONTEXT[context].followsTimeline ? sidePx / HALF : 0);

export const barKeys = (context: BarContext): Region => CONTEXT[context].keys;

export const barHidden = (context: BarContext, frameDialogOpen: boolean): boolean => CONTEXT[context].yieldsToDialogs && frameDialogOpen;
