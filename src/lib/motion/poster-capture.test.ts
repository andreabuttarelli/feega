import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POSTER_DEBOUNCE_MS, posterJob, posterSecond } from './poster-capture';

describe('the poster of a composition', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('is taken at 40% of the video, where the content is on screen', () => {
    expect(posterSecond({ durationInFrames: 300, fps: 30 })).toBe(4);
  });

  it('a burst of saves uploads one poster, after the edits settle', async () => {
    const shoot = vi.fn(async () => 'data:image/jpeg;base64,AA==');
    const send = vi.fn(async () => {});
    const job = posterJob(shoot, send);

    job.schedule();
    job.schedule();
    job.schedule();
    await vi.advanceTimersByTimeAsync(POSTER_DEBOUNCE_MS);

    expect(shoot).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('data:image/jpeg;base64,AA==');
  });

  it('an empty capture sends nothing', async () => {
    const send = vi.fn(async () => {});
    const job = posterJob(async () => '', send);

    job.schedule();
    await vi.advanceTimersByTimeAsync(POSTER_DEBOUNCE_MS);

    expect(send).not.toHaveBeenCalled();
  });
});
