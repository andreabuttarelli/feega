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
