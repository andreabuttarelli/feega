import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COPIED_MS, SNACKBAR_MS, copyFeedback, type Feedback } from './onboarding-copy';

const KEY = 'mcp';

describe('copy feedback', () => {
  const seen: Feedback[] = [];
  const last = () => seen[seen.length - 1];

  beforeEach(() => {
    vi.useFakeTimers();
    seen.length = 0;
  });

  afterEach(() => vi.useRealTimers());

  it('marks the button copied and shows the snackbar at once', () => {
    copyFeedback((feedback) => seen.push(feedback))(KEY);

    expect(last()).toEqual({ copied: KEY, snackbar: true });
  });

  it('puts the button back before the snackbar leaves', () => {
    copyFeedback((feedback) => seen.push(feedback))(KEY);
    vi.advanceTimersByTime(COPIED_MS);

    expect(last()).toEqual({ copied: null, snackbar: true });

    vi.advanceTimersByTime(SNACKBAR_MS - COPIED_MS);

    expect(last()).toEqual({ copied: null, snackbar: false });
  });

  it('restarts the clock on a second copy', () => {
    const copy = copyFeedback((feedback) => seen.push(feedback));
    copy(KEY);
    vi.advanceTimersByTime(COPIED_MS - 1);
    copy(KEY);
    vi.advanceTimersByTime(COPIED_MS - 1);

    expect(last().copied).toBe(KEY);
  });
});
