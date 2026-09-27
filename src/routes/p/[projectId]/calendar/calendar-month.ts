export type CalendarMonth = { year: number; month: number };

const MONTH_PARAM = /^(\d{4})-(\d{2})$/;

export function monthOf(param: string | null, now = new Date()): CalendarMonth {
  const match = param?.match(MONTH_PARAM);
  if (!match) return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };

  const month = Number(match[2]);
  if (month < 1 || month > 12) return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };

  return { year: Number(match[1]), month };
}
