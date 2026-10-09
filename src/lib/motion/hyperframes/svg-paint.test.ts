import { describe, expect, it } from 'vitest';
import { paintSvg, type Painter } from './svg-paint';

const FRAME = 'data:image/svg+xml,frame';

function engine(input: { settles: boolean; arrivals: number[] }) {
  let ticks = 0;
  const landed = () => input.arrivals.filter((at) => ticks >= at).length;
  const painter: Painter<object, string> = {
    load: async () => ({}),
    settles: () => input.settles,
    print: () => `${landed()} pictures`,
    blank: (print) => print.startsWith('0 '),
    tick: async () => {
      ticks += 1;
    },
    draw: (_img, width, height) => `${landed()} of ${input.arrivals.length} pictures at ${width}x${height}`
  };
  return { painter, ticks: () => ticks };
}

describe('paintSvg', () => {
  it('waits for the pictures nested in the frame on an engine that loads them only after a first draw, like WebKit', async () => {
    const webkit = engine({ settles: true, arrivals: [2] });

    expect(await paintSvg(FRAME, 1920, 1080, webkit.painter)).toBe('1 of 1 pictures at 1920x1080');
  });

  it('keeps waiting while nested pictures are still landing one after another', async () => {
    const webkit = engine({ settles: true, arrivals: [1, 3] });

    expect(await paintSvg(FRAME, 1920, 1080, webkit.painter)).toBe('2 of 2 pictures at 1920x1080');
  });

  it('draws at once on an engine whose first draw is already complete', async () => {
    const chromium = engine({ settles: false, arrivals: [0] });

    expect(await paintSvg(FRAME, 1920, 1080, chromium.painter)).toBe('1 of 1 pictures at 1920x1080');
    expect(chromium.ticks()).toBe(0);
  });

  it('draws what it has after a bounded wait rather than hanging', async () => {
    const stuck = engine({ settles: true, arrivals: [Number.POSITIVE_INFINITY] });

    expect(await paintSvg(FRAME, 1920, 1080, stuck.painter)).toBe('0 of 1 pictures at 1920x1080');
    expect(stuck.ticks()).toBeLessThanOrEqual(120);
  });

  it('keeps waiting while a layer made only of a nested picture is still blank, as WebKit under four lanes', async () => {
    const slow = engine({ settles: true, arrivals: [30] });

    expect(await paintSvg(FRAME, 1920, 1080, slow.painter)).toBe('1 of 1 pictures at 1920x1080');
  });
});
