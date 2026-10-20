import { describe, expect, it } from 'vitest';
import { Depth, Gesture } from '$lib/motion/drill';
import { drillRequests } from './frame-drill';

describe('a drill asked on a closed frame', () => {
  it('is taken once by the editor that opens on that frame', () => {
    const asks = drillRequests(() => 0);
    asks.request('a', { x: 0.4, y: 0.1 }, Gesture.Double);
    expect(asks.take('b')).toBeNull();
    expect(asks.take('a')).toEqual({ at: { x: 0.4, y: 0.1 }, gesture: Gesture.Double, from: Depth.Canvas });
    expect(asks.take('a')).toBeNull();
  });

  it('a click turns into a double-click when the second click lands after the frame opened', () => {
    const asks = drillRequests(() => 0);
    asks.request('a', { x: 0.4, y: 0.1 }, Gesture.Click);
    asks.upgrade('b', Gesture.Deep);
    asks.upgrade('a', Gesture.Double);
    expect(asks.take('a')?.gesture).toBe(Gesture.Double);
  });

  it('a second click landing after the editor took the click still reaches it', () => {
    const asks = drillRequests(() => 0);
    const late: unknown[] = [];
    asks.request('a', { x: 0.4, y: 0.1 }, Gesture.Click);
    expect(asks.take('a', (ask) => late.push(ask))?.gesture).toBe(Gesture.Click);
    asks.upgrade('a', Gesture.Double);
    expect(late).toEqual([{ at: { x: 0.4, y: 0.1 }, gesture: Gesture.Double, from: Depth.Canvas }]);
    asks.upgrade('a', Gesture.Double);
    expect(late).toHaveLength(1);
  });

  it('an editor already open on the frame gets the ask at once, and one opening right after still finds it', () => {
    const asks = drillRequests(() => 0);
    const got: unknown[] = [];
    const stop = asks.listen('a', (ask) => got.push(ask));
    asks.request('a', { x: 0.5, y: 0.5 }, Gesture.Double);
    expect(got).toEqual([{ at: { x: 0.5, y: 0.5 }, gesture: Gesture.Double, from: Depth.Canvas }]);
    expect(asks.take('a')).toEqual({ at: { x: 0.5, y: 0.5 }, gesture: Gesture.Double, from: Depth.Canvas });
    stop();
    asks.request('a', null, Gesture.Click);
    expect(got).toHaveLength(1);
  });

  it('goes stale when no editor opened soon after', () => {
    let now = 0;
    const asks = drillRequests(() => now);
    asks.request('a', { x: 0.5, y: 0.5 }, Gesture.Deep);
    now = 10_000;
    expect(asks.take('a')).toBeNull();
  });

  it('Enter on a selected frame asks from inside the frame, with no point', () => {
    const asks = drillRequests(() => 0);
    asks.request('a', null, Gesture.Enter, Depth.Frame);
    expect(asks.take('a')).toEqual({ at: null, gesture: Gesture.Enter, from: Depth.Frame });
  });

  it('a pointer gesture starts from the canvas', () => {
    const asks = drillRequests(() => 0);
    asks.request('a', { x: 0.5, y: 0.5 }, Gesture.Click);
    expect(asks.take('a')?.from).toBe(Depth.Canvas);
  });
});

describe('a press that is still held when the editor opens', () => {
  const drag = { pointer: 7, client: { x: 10, y: 20 } };

  it('hands the held pointer to the editor with the ask', () => {
    const asks = drillRequests(() => 0);
    asks.request('a', { x: 0.4, y: 0.1 }, Gesture.Click, Depth.Canvas, drag);

    expect(asks.take('a')).toEqual({ at: { x: 0.4, y: 0.1 }, gesture: Gesture.Click, from: Depth.Canvas, drag });
  });

  it('forgets the pointer once it is released before the editor opens', () => {
    const asks = drillRequests(() => 0);
    asks.request('a', { x: 0.4, y: 0.1 }, Gesture.Click, Depth.Canvas, drag);
    asks.release('a');

    expect(asks.take('a')).toEqual({ at: { x: 0.4, y: 0.1 }, gesture: Gesture.Click, from: Depth.Canvas });
  });
});
