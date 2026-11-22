import { describe, expect, it } from 'vitest';
import { ANNUAL_SAVING_PERCENT, CLOUD_PRICES, CloudInterval, isCloudInterval } from './cloud-pricing';

describe('Cloud display prices', () => {
  it('sells an editor seat at 15 a month or 12 a month billed yearly', () => {
    expect(CLOUD_PRICES[CloudInterval.Monthly].perMonth).toBe(15);
    expect(CLOUD_PRICES[CloudInterval.Annual].perMonth).toBe(12);
    expect(CLOUD_PRICES[CloudInterval.Annual].perYear).toBe(144);
  });

  it('derives the annual saving from the table', () => {
    expect(ANNUAL_SAVING_PERCENT).toBe(20);
  });

  it('recognises only the two intervals', () => {
    expect(isCloudInterval('annual')).toBe(true);
    expect(isCloudInterval('weekly')).toBe(false);
  });
});
