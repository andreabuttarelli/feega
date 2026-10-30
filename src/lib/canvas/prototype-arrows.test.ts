import { describe, expect, it } from 'vitest';
import { ActionKind, TriggerKind } from '@feega/motion-core/motion/prototype/model';
import { arrowsFor, curveBetween } from './prototype-arrows';

const view = { x: 0, y: 0, zoom: 1 };
const frames = [
  { id: 'a', x: 0, y: 0, w: 100, h: 200, bar: 0 },
  { id: 'b', x: 300, y: 100, w: 100, h: 200, bar: 0 }
];

describe('prototype arrows', () => {
  it('draws from the right edge of the source to the left edge of the target', () => {
    const [arrow] = arrowsFor([{ id: 'i1', clip: 'c1', from: 'a', to: 'b', trigger: TriggerKind.Click, action: ActionKind.Navigate }], frames, view);

    expect(arrow.path.startsWith('M100,100 ')).toBe(true);
    expect(arrow.path.endsWith(' 300,200')).toBe(true);
  });

  it('follows the zoom and pan of the canvas', () => {
    const [arrow] = arrowsFor([{ id: 'i1', clip: 'c1', from: 'a', to: 'b', trigger: TriggerKind.Click, action: ActionKind.Navigate }], frames, { x: 10, y: 20, zoom: 2 });

    expect(arrow.path.startsWith('M210,220 ')).toBe(true);
  });

  it('starts at the right edge of the linked element when its box is known', () => {
    const link = { id: 'i1', clip: 'c1', from: 'a', to: 'b', trigger: TriggerKind.Click, action: ActionKind.Navigate };
    const [arrow] = arrowsFor([link], frames, view, new Map([['a:c1', { x: 10, y: 40, w: 50, h: 20 }]]));

    expect(arrow.path.startsWith('M60,50 ')).toBe(true);
  });

  it('skips a link whose frame is not on screen data', () => {
    expect(arrowsFor([{ id: 'i1', clip: 'c1', from: 'a', to: 'gone', trigger: TriggerKind.Click, action: ActionKind.Navigate }], frames, view)).toEqual([]);
  });

  it('puts the arrow head on the end point', () => {
    expect(curveBetween({ x: 0, y: 0 }, { x: 100, y: 0 }).head.startsWith('100,0 ')).toBe(true);
  });
});
