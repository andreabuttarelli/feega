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
  Comment = 'comment',
  More = 'more',
  Templates = 'templates',
  FrameTemplates = 'frame-templates',
  Draw = 'draw',
  Image = 'image',
  FrameLibrary = 'frame-library'
}

const CANVAS_SLOTS: Record<BarMode, readonly BarSlot[]> = {
  [BarMode.Design]: [BarSlot.Mode, BarSlot.Draw, BarSlot.Upload, BarSlot.Comment, BarSlot.FrameTemplates],
  [BarMode.Generate]: [BarSlot.Mode, BarSlot.Select, BarSlot.Generate, BarSlot.More, BarSlot.Templates, BarSlot.Comment, BarSlot.FrameTemplates]
};

const FRAME_SLOTS: readonly BarSlot[] = [BarSlot.Image, BarSlot.FrameLibrary];

const SLOTS: Record<BarContext, Record<BarMode, readonly BarSlot[]>> = {
  [BarContext.Canvas]: CANVAS_SLOTS,
  [BarContext.Frame]: {
    [BarMode.Design]: [...CANVAS_SLOTS[BarMode.Design], ...FRAME_SLOTS],
    [BarMode.Generate]: [...CANVAS_SLOTS[BarMode.Generate], ...FRAME_SLOTS]
  }
};

export const barSlots = (context: BarContext, mode: BarMode): readonly BarSlot[] => SLOTS[context][mode];

export const barContextFor = (selectedFrame: string | null): BarContext => (selectedFrame ? BarContext.Frame : BarContext.Canvas);

export const BAR_MODE_KEY = 'feega:canvas-bar-mode';

const MODES = new Set<string>(Object.values(BarMode));

export const readBarMode = (stored: string | null): BarMode => (stored && MODES.has(stored) ? (stored as BarMode) : BarMode.Generate);
