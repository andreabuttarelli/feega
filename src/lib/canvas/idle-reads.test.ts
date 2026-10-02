import { describe, expect, it } from 'vitest';
import { CANVAS_POLLS, IDLE_CANVAS_READ_BUDGET_PER_MIN, idleReadsPerMinute } from './idle-reads';

describe('an open canvas nobody touches stays almost silent on the database', () => {
  it('its timers add up to no more than the budget per minute, even with several calendars', () => {
    const calendars = 3;

    expect(idleReadsPerMinute(CANVAS_POLLS, { calendar: calendars })).toBeLessThanOrEqual(IDLE_CANVAS_READ_BUDGET_PER_MIN);
  });

  it('counts each poll once per instance and per interval', () => {
    const polls = { calendar: { everyMs: 30_000, readsPerRun: 2 } };

    expect(idleReadsPerMinute(polls, { calendar: 2 })).toBe(8);
  });
});
