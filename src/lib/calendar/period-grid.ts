import { dayKey, isoWeekday, localDayKey, monthGrid, shiftedDay, toGridDay, type GridDay } from './month-grid';

export enum CalendarView {
  Week = 'week',
  Month = 'month'
}

export const CALENDAR_VIEWS = [CalendarView.Week, CalendarView.Month] as const;

const DAYS_PER_WEEK = 7;
const DEFAULT_PLANNED_HOUR = 10;
const MINUTE_MS = 60_000;

type Day = { year: number; month: number; day: number };

function parseDayKey(key: string): Day {
  const [year, month, day] = key.split('-').map(Number);
  return { year, month, day };
}

export function gridDayKey(d: GridDay): string {
  return dayKey(d.year, d.month, d.day);
}

function todayKeyOf(today: Date): string {
  return dayKey(today.getUTCFullYear(), today.getUTCMonth() + 1, today.getUTCDate());
}

function weekGrid(anchor: Day, today: Date): GridDay[][] {
  const monday = shiftedDay(anchor.year, anchor.month, anchor.day, 1 - isoWeekday(anchor.year, anchor.month, anchor.day));
  const todayKey = todayKeyOf(today);
  const days = Array.from({ length: DAYS_PER_WEEK }, (_, i) => {
    const d = shiftedDay(monday.year, monday.month, monday.day, i);
    return toGridDay(d.year, d.month, d.day, false, todayKey);
  });
  return [days];
}

const GRID_OF: Record<CalendarView, (anchor: Day, today: Date) => GridDay[][]> = {
  [CalendarView.Week]: weekGrid,
  [CalendarView.Month]: (anchor, today) => monthGrid(anchor.year, anchor.month, today)
};

export function periodGrid(view: CalendarView, anchorKey: string, today: Date): GridDay[][] {
  return GRID_OF[view](parseDayKey(anchorKey), today);
}

const SHIFT_OF: Record<CalendarView, (anchor: Day, step: number) => Day> = {
  [CalendarView.Week]: (a, step) => shiftedDay(a.year, a.month, a.day, step * DAYS_PER_WEEK),
  [CalendarView.Month]: (a, step) => {
    const first = new Date(Date.UTC(a.year, a.month - 1 + step, 1));
    return { year: first.getUTCFullYear(), month: first.getUTCMonth() + 1, day: 1 };
  }
};

export function shiftAnchor(view: CalendarView, anchorKey: string, step: number): string {
  const d = SHIFT_OF[view](parseDayKey(anchorKey), step);
  return dayKey(d.year, d.month, d.day);
}

const TITLE_LOCALE = 'en-US';

const TITLE_OF: Record<CalendarView, (anchor: Day) => string> = {
  [CalendarView.Week]: (a) => {
    const monday = weekGrid(a, new Date())[0][0];
    const at = Date.UTC(monday.year, monday.month - 1, monday.day);
    const label = new Intl.DateTimeFormat(TITLE_LOCALE, { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).format(at);
    return `Week of ${label}`;
  },
  [CalendarView.Month]: (a) =>
    new Intl.DateTimeFormat(TITLE_LOCALE, { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(Date.UTC(a.year, a.month - 1, 1))
};

export function periodTitle(view: CalendarView, anchorKey: string): string {
  return TITLE_OF[view](parseDayKey(anchorKey));
}

export type Placeable = { plannedFor: string | null; deliveries: { scheduledFor: string | null }[] };

export function placedInstant(post: Placeable): string | null {
  return post.deliveries.find((d) => d.scheduledFor)?.scheduledFor ?? post.plannedFor;
}

export function dayKeyOf(instant: string, timeZone: string): string {
  return localDayKey(instant, timeZone);
}

function wallClock(instantMs: number, timeZone: string): { hour: number; minute: number; asUtcMs: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(instantMs)).map((p) => [p.type, Number(p.value)]));
  const asUtcMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return { hour: parts.hour, minute: parts.minute, asUtcMs };
}

function offsetMs(instantMs: number, timeZone: string): number {
  const flooredToMinute = Math.floor(instantMs / MINUTE_MS) * MINUTE_MS;
  return wallClock(flooredToMinute, timeZone).asUtcMs - flooredToMinute;
}

export function plannedInstant(dayKeyValue: string, timeZone: string, keepTimeOf: string | null): string {
  const kept = keepTimeOf ? wallClock(Date.parse(keepTimeOf), timeZone) : null;
  const hour = kept?.hour ?? DEFAULT_PLANNED_HOUR;
  const minute = kept?.minute ?? 0;

  const { year, month, day } = parseDayKey(dayKeyValue);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const guess = wall - offsetMs(wall, timeZone);
  return new Date(wall - offsetMs(guess, timeZone)).toISOString();
}
