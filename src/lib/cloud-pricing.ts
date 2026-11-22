export enum CloudInterval {
  Monthly = 'monthly',
  Annual = 'annual'
}

export type CloudIntervalName = `${CloudInterval}`;

export const CLOUD_CURRENCY_SYMBOL = '€';

const MONTHS_PER_YEAR = 12;
const PERCENT = 100;

export const CLOUD_PRICES: Record<CloudInterval, { perMonth: number; perYear: number }> = {
  [CloudInterval.Monthly]: { perMonth: 15, perYear: 15 * MONTHS_PER_YEAR },
  [CloudInterval.Annual]: { perMonth: 12, perYear: 12 * MONTHS_PER_YEAR }
};

export const ANNUAL_SAVING_PERCENT = Math.round(
  (1 - CLOUD_PRICES[CloudInterval.Annual].perYear / CLOUD_PRICES[CloudInterval.Monthly].perYear) * PERCENT
);

const INTERVALS: readonly string[] = Object.values(CloudInterval);

export function isCloudInterval(value: unknown): value is CloudInterval {
  return typeof value === 'string' && INTERVALS.includes(value);
}
