import { describe, expect, it } from 'vitest';
import { Gesture } from '$lib/motion/drill';
import { drillRequests } from './frame-drill';

describe('a drill asked on a closed frame', () => {
  it('is taken once by the editor that opens on that frame', () => {
    const asks = drillRequests(() => 0);
    asks.request('a', { x: 0.4, y: 0.1 }, Gesture.Double);
    expect(asks.take('b')).toBeNull();
    expect(asks.take('a')).toEqual({ at: { x: 0.4, y: 0.1 }, gesture: Gesture.Double });
    expect(asks.take('a')).toBeNull();
  });

  it('a click turns into a double-click when the second click lands after the frame opened', () => {
    const asks = drillRequests(() => 0);
    asks.request('a', { x: 0.4, y: 0.1 }, Gesture.Click);
    asks.upgrade('b', Gesture.Deep);
    asks.upgrade('a', Gesture.Double);
    expect(asks.take('a')?.gesture).toBe(Gesture.Double);
  });

  it('a plain click is never taken: it would undo a selection made since', () => {
    const asks = drillRequests(() => 0);
    asks.request('a', { x: 0.4, y: 0.1 }, Gesture.Click);
    expect(asks.take('a')).toBeNull();
  });

  it('goes stale when no editor opened soon after', () => {
    let now = 0;
    const asks = drillRequests(() => now);
    asks.request('a', { x: 0.5, y: 0.5 }, Gesture.Deep);
    now = 10_000;
    expect(asks.take('a')).toBeNull();
  });
});
