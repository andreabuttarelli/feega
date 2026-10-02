const DAY_MS = 86_400_000;
const SATURDAY = 6;
const SUNDAY = 0;

const isWeekend = (d: Date): boolean => d.getUTCDay() === SATURDAY || d.getUTCDay() === SUNDAY;

export function addBusinessDays(from: Date, days: number): Date {
  let at = new Date(from.getTime());
  let left = days;

  while (left > 0) {
    at = new Date(at.getTime() + DAY_MS);
    if (!isWeekend(at)) {
      left--;
    }
  }

  return at;
}
