export type PointerPoint = { x: number; y: number };

export enum DropVerdict {
  Taken = 'taken',
  Ignored = 'ignored'
}

export function pointOf(event: MouseEvent | TouchEvent): PointerPoint {
  if ('changedTouches' in event && event.changedTouches.length) {
    const touch = event.changedTouches[0];
    return { x: touch.clientX, y: touch.clientY };
  }
  const mouse = event as MouseEvent;
  return { x: mouse.clientX, y: mouse.clientY };
}

export type DayTarget = { calendarId: string; dayKey: string; element: HTMLElement };

export function dayUnderPointer(at: PointerPoint, draggedIds: string[]): DayTarget | null {
  for (const element of document.elementsFromPoint(at.x, at.y)) {
    const day = (element as HTMLElement).closest<HTMLElement>('[data-calendar-day]');
    const calendar = day?.closest<HTMLElement>('[data-calendar-node]');
    const calendarId = calendar?.dataset.calendarNode;
    if (!day || !calendarId || draggedIds.includes(calendarId)) {
      continue;
    }
    return { calendarId, dayKey: day.dataset.calendarDay ?? '', element: day };
  }
  return null;
}

export type StageRect = { left: number; top: number; width: number; height: number };

const unit = (value: number) => Math.min(1, Math.max(0, value));

export function fractionIn(stage: StageRect, at: PointerPoint): PointerPoint {
  return { x: unit((at.x - stage.left) / Math.max(stage.width, 1)), y: unit((at.y - stage.top) / Math.max(stage.height, 1)) };
}

export type FrameTarget = { frameId: string; at: PointerPoint };

export function frameUnderPointer(at: PointerPoint, exceptId: string | null = null): FrameTarget | null {
  for (const element of document.elementsFromPoint(at.x, at.y)) {
    const frame = (element as HTMLElement).closest<HTMLElement>('[data-motion-node]');
    const frameId = frame?.dataset.motionNode;
    const stage = frame?.querySelector<HTMLElement>('[data-frame-stage]');
    if (!frameId || !stage || frameId === exceptId) {
      continue;
    }
    return { frameId, at: fractionIn(stage.getBoundingClientRect(), at) };
  }
  return null;
}

export const isOutside = (stage: StageRect, at: PointerPoint) => at.x < stage.left || at.y < stage.top || at.x > stage.left + stage.width || at.y > stage.top + stage.height;

export enum DragPhase {
  Over = 'over',
  Back = 'back',
  Drop = 'drop'
}

export type ElementOut = { clipId: string; client: PointerPoint; box: StageRect | null };

export type MoveOut = (out: ElementOut, phase: DragPhase, version: number) => Promise<number | null>;

export type CanvasUndo = { owns: (nodeId: string, version: number) => boolean; run: () => Promise<void> };

export enum UndoRoute {
  Here = 'here',
  Canvas = 'canvas'
}
