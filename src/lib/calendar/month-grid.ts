const DAYS_PER_WEEK = 7;
const MONDAY = 1;

export type GridDay = {
  year: number;
  month: number;
  day: number;
  weekday: number;
  outside: boolean;
  isToday: boolean;
};

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isoWeekday(year: number, month: number, day: number): number {
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

function shiftedDay(year: number, month: number, day: number, offset: number) {
  const shifted = new Date(Date.UTC(year, month - 1, day + offset));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

function toGridDay(
  year: number,
  month: number,
  day: number,
  outside: boolean,
  todayKey: string
): GridDay {
  const weekday = isoWeekday(year, month, day) % DAYS_PER_WEEK;
  const key = dayKey(year, month, day);
  return { year, month, day, weekday, outside, isToday: key === todayKey };
}

function dayKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function monthGrid(year: number, month: number, today: Date): GridDay[][] {
  const todayKey = dayKey(today.getUTCFullYear(), today.getUTCMonth() + 1, today.getUTCDate());
  const total = daysInMonth(year, month);
  const leadingCount = isoWeekday(year, month, 1) - MONDAY;

  const days: GridDay[] = [];

  for (let i = leadingCount; i > 0; i -= 1) {
    const d = shiftedDay(year, month, 1, -i);
    days.push(toGridDay(d.year, d.month, d.day, true, todayKey));
  }

  for (let day = 1; day <= total; day += 1) {
    days.push(toGridDay(year, month, day, false, todayKey));
  }

  const trailingCount = (DAYS_PER_WEEK - (days.length % DAYS_PER_WEEK)) % DAYS_PER_WEEK;
  for (let i = 1; i <= trailingCount; i += 1) {
    const d = shiftedDay(year, month, total, i);
    days.push(toGridDay(d.year, d.month, d.day, true, todayKey));
  }

  const weeks: GridDay[][] = [];
  for (let i = 0; i < days.length; i += DAYS_PER_WEEK) {
    weeks.push(days.slice(i, i + DAYS_PER_WEEK));
  }

  return weeks;
}

export type PlaceablePost = { id: string; scheduledFor: string | null };

export type PlacedPosts = {
  byDay: Record<string, string[]>;
  unscheduled: string[];
};

function localDayKey(scheduledFor: string, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(scheduledFor)).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function placePosts(posts: PlaceablePost[], grid: GridDay[][], timeZone: string): PlacedPosts {
  const gridKeys = new Set(grid.flat().map((d) => dayKey(d.year, d.month, d.day)));
  const byDay: Record<string, string[]> = {};
  const unscheduled: string[] = [];

  for (const post of posts) {
    if (!post.scheduledFor) {
      unscheduled.push(post.id);
      continue;
    }

    const key = localDayKey(post.scheduledFor, timeZone);
    if (!gridKeys.has(key)) continue;

    byDay[key] = [...(byDay[key] ?? []), post.id];
  }

  return { byDay, unscheduled };
}
