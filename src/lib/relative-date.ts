const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const UNITS: { unit: Intl.RelativeTimeFormatUnit; ms: number; below: number }[] = [
  { unit: 'minute', ms: MINUTE, below: HOUR },
  { unit: 'hour', ms: HOUR, below: DAY },
  { unit: 'day', ms: DAY, below: 7 * DAY },
  { unit: 'week', ms: 7 * DAY, below: 35 * DAY },
  { unit: 'month', ms: 30 * DAY, below: 365 * DAY },
  { unit: 'year', ms: 365 * DAY, below: Infinity }
];

const said = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function relativeDate(iso: string, now = new Date()): string {
  const elapsed = Math.max(0, now.getTime() - new Date(iso).getTime());
  if (elapsed < MINUTE) {
    return 'just now';
  }

  const { unit, ms } = UNITS.find((u) => elapsed < u.below)!;
  return said.format(-Math.floor(elapsed / ms), unit);
}
