export enum BarContext {
  Canvas = 'canvas',
  Frame = 'frame'
}

export enum BarSlot {
  Select = 'select',
  Insert = 'insert',
  Comment = 'comment'
}

export const BAR_SLOTS: readonly BarSlot[] = [BarSlot.Select, BarSlot.Insert, BarSlot.Comment];

export const barContextFor = (selectedFrame: string | null): BarContext => (selectedFrame ? BarContext.Frame : BarContext.Canvas);
