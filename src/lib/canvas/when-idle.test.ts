import { afterEach, describe, expect, it, vi } from 'vitest';
import { whenIdle } from './when-idle';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('whenIdle', () => {
  it('runs after the fallback delay when the browser has no idle callback, and can be cancelled', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', undefined);
    const run = vi.fn();
    whenIdle(run)();
    vi.runAllTimers();
    expect(run).not.toHaveBeenCalled();

    whenIdle(run);
    vi.runAllTimers();
    expect(run).toHaveBeenCalledOnce();
  });

  it('hands the work to the idle callback when there is one', () => {
    const request = vi.fn(() => 7);
    const cancelIdle = vi.fn();
    vi.stubGlobal('requestIdleCallback', request);
    vi.stubGlobal('cancelIdleCallback', cancelIdle);

    whenIdle(() => {})();

    expect(request).toHaveBeenCalledOnce();
    expect(cancelIdle).toHaveBeenCalledWith(7);
  });
});
