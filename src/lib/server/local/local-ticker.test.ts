import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOCAL_TICK_MS, startLocalTicker } from './local-ticker';

afterEach(() => vi.useRealTimers());

describe('local mode advances queued provider jobs without the cloud cron', () => {
  it('reconciles the runs on its own every tick', async () => {
    vi.useFakeTimers();
    const tick = vi.fn().mockResolvedValue(undefined);
    const stop = startLocalTicker({} as never, tick);

    await vi.advanceTimersByTimeAsync(LOCAL_TICK_MS * 2);
    stop();

    expect(tick).toHaveBeenCalledTimes(2);
  });

  it('keeps ticking after a failed reconcile, and never runs two at once', async () => {
    vi.useFakeTimers();
    let release: () => void = () => {};
    const tick = vi.fn().mockRejectedValueOnce(new Error('kie down')).mockImplementation(() => new Promise<void>((r) => (release = r)));
    const stop = startLocalTicker({} as never, tick);

    await vi.advanceTimersByTimeAsync(LOCAL_TICK_MS * 3);
    release();
    stop();

    expect(tick).toHaveBeenCalledTimes(2);
  });
});
