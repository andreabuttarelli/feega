export enum ComponentDropOn {
  Frame = 'frame',
  Canvas = 'canvas'
}

export type ComponentDropTarget = { on: ComponentDropOn.Frame; frameId: string } | { on: ComponentDropOn.Canvas };

export type DropFrame = { id: string; takesDrops: boolean };

export function componentDropTarget(hitId: string | null, frames: readonly DropFrame[], fallbackId: string | null = null): ComponentDropTarget {
  const taking = (id: string | null) => frames.find((f) => f.id === id && f.takesDrops);
  const frame = taking(hitId) ?? taking(fallbackId);
  return frame ? { on: ComponentDropOn.Frame, frameId: frame.id } : { on: ComponentDropOn.Canvas };
}
