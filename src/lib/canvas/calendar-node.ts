import { CALENDAR_VIEWS, CalendarView } from '$lib/calendar/period-grid';
import { dayKey } from '$lib/calendar/month-grid';

export enum CalendarScope {
  Canvas = 'canvas',
  Brand = 'brand'
}

export const CALENDAR_SCOPES = [CalendarScope.Canvas, CalendarScope.Brand] as const;

export type CalendarNode = {
  id: string;
  view: CalendarView;
  scope: CalendarScope;
  brandId: string | null;
  anchor: string;
};

const CALENDAR_NODE_SIZE = { w: 760, h: 520 };

export function calendarNodeSize(): { w: number; h: number } {
  return CALENDAR_NODE_SIZE;
}

function todayKey(today: Date): string {
  return dayKey(today.getFullYear(), today.getMonth() + 1, today.getDate());
}

export function newCalendarData(today: Date): Record<string, unknown> {
  return { view: CalendarView.Week, scope: CalendarScope.Canvas, brand_id: null, anchor: todayKey(today) };
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function calendarOf(row: { id: string; type: string; data: Record<string, unknown> }, today = new Date()): CalendarNode | null {
  if (row.type !== 'calendar') {
    return null;
  }

  const anchor = row.data.anchor;
  return {
    id: row.id,
    view: pick(row.data.view, CALENDAR_VIEWS, CalendarView.Week),
    scope: pick(row.data.scope, CALENDAR_SCOPES, CalendarScope.Canvas),
    brandId: typeof row.data.brand_id === 'string' && row.data.brand_id ? row.data.brand_id : null,
    anchor: typeof anchor === 'string' && ISO_DAY.test(anchor) ? anchor : todayKey(today)
  };
}

export function calendarData(node: CalendarNode): Record<string, unknown> {
  return { view: node.view, scope: node.scope, brand_id: node.brandId, anchor: node.anchor };
}
