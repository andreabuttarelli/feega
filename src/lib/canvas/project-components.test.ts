import { describe, expect, it } from 'vitest';
import { firstTiles, mainLocation, matchingComponents, tileCount, type CanvasComponents } from './project-components';

const component = (name: string, frameId = 'f') => ({ key: name, frameId, home: frameId, frameName: `Frame ${frameId}`, name, variants: [], thumb: null, revision: 1 });
const canvases: CanvasComponents[] = [
  { canvasId: 'c1', canvasName: 'Home', components: [component('Button'), component('Card')] },
  { canvasId: 'c2', canvasName: 'Checkout', components: [component('Price', 'f2')] }
];

describe('searching components', () => {
  it('keeps every canvas when the search is empty', () => {
    expect(matchingComponents(canvases, ' ')).toHaveLength(2);
  });

  it('matches a component name and drops canvases left empty', () => {
    expect(matchingComponents(canvases, 'butt')).toEqual([{ ...canvases[0], components: [component('Button')] }]);
  });

  it('matches the canvas name too', () => {
    expect(matchingComponents(canvases, 'check')[0].components.map((c) => c.name)).toEqual(['Price']);
  });
});

describe('showing a long list a page at a time', () => {
  it('keeps only the first tiles, across canvases, in order', () => {
    expect(firstTiles(canvases, 2)).toEqual([canvases[0]]);
    expect(firstTiles(canvases, 3).map((c) => c.components.map((g) => g.name))).toEqual([['Button', 'Card'], ['Price']]);
  });

  it('counts one tile per variant', () => {
    const set = { ...component('Tab'), variants: [{ compId: 'a', variant: {} }, { compId: 'b', variant: {} }] };

    expect(tileCount([{ canvasId: 'c', canvasName: 'C', components: [set, component('Chip')] }])).toBe(3);
    expect(firstTiles([{ canvasId: 'c', canvasName: 'C', components: [set, component('Chip')] }], 2)[0].components).toEqual([set]);
  });
});

describe('where a main component lives', () => {
  it('names the canvas and frame that hold it', () => {
    expect(mainLocation(canvases, 'f2')).toEqual({ canvasId: 'c2', label: 'Checkout › Frame f2' });
  });

  it('is unknown for a frame with no components', () => {
    expect(mainLocation(canvases, 'gone')).toBeNull();
  });
});
