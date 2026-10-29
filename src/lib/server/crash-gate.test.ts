import { describe, expect, it } from 'vitest';
import { KEPT_IN_FULL_PER_DAY, REPORTS_PER_USER_PER_DAY, SAMPLE_ONE_IN, Verdict, createCrashGate } from './crash-gate';

const DAY = 24 * 60 * 60 * 1000;

describe('the crash gate', () => {
  it('keeps the first reports of the day, then one in ten', () => {
    const admit = createCrashGate();
    const verdicts = Array.from({ length: KEPT_IN_FULL_PER_DAY + SAMPLE_ONE_IN }, (_, i) => admit(`u${i}`));

    expect(verdicts.slice(0, KEPT_IN_FULL_PER_DAY).every((v) => v === Verdict.Keep)).toBe(true);
    expect(verdicts.slice(KEPT_IN_FULL_PER_DAY).filter((v) => v === Verdict.Keep)).toHaveLength(1);
  });

  it('limits one user and forgets at midnight', () => {
    let now = 0;
    const admit = createCrashGate(() => now);
    for (let i = 0; i < REPORTS_PER_USER_PER_DAY; i++) {
      admit('a');
    }
    expect(admit('a')).toBe(Verdict.OverLimit);

    now = DAY;
    expect(admit('a')).toBe(Verdict.Keep);
  });
});
