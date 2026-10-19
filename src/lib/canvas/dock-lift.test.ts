import { describe, expect, it } from 'vitest';
import { dockLift, followDocks, type Box, type Watch } from './dock-lift';

const box = (top: number, height: number, bottom = top + height) => ({ getBoundingClientRect: () => ({ top, height, bottom }) as DOMRect }) as Box;

function fakeWatch() {
  const watched: Box[] = [];
  let fire = () => {};
  const watch: Watch = (targets, onchange) => {
    watched.push(...targets);
    fire = onchange;
    return () => watched.splice(0);
  };
  return { watch, watched, resize: () => fire() };
}

describe('dockLift', () => {
  it('lifts by the tallest dock overlapping the host bottom', () => {
    expect(dockLift(900, [{ top: 700, height: 200 }, { top: 820, height: 80 }])).toBe(200);
  });

  it('ignores a dock that is not laid out', () => {
    expect(dockLift(900, [{ top: 0, height: 0 }])).toBe(0);
  });
});

describe('followDocks', () => {
  it('reads layout once at start and again only when something resizes, never per frame', () => {
    let reads = 0;
    const counted = (b: Box) => ({ getBoundingClientRect: () => (reads++, b.getBoundingClientRect()) }) as Box;
    const { watch, watched, resize } = fakeWatch();
    const lifts: number[] = [];

    followDocks(counted(box(0, 900)), () => [counted(box(700, 200))], (px) => lifts.push(px), watch);
    expect(reads).toBe(2);
    expect(watched).toHaveLength(2);

    resize();
    expect(reads).toBe(4);
    expect(lifts).toEqual([200, 200]);
  });

  it('stops watching when disposed', () => {
    const { watch, watched } = fakeWatch();
    const stop = followDocks(box(0, 900), () => [box(700, 200)], () => {}, watch);

    stop();
    expect(watched).toHaveLength(0);
  });
});
