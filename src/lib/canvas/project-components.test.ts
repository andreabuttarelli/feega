import { describe, expect, it } from 'vitest';
import { matchingComponents, type CanvasComponents } from './project-components';

const component = (name: string) => ({ key: name, frameId: 'f', name, variants: [], thumb: null });
const canvases: CanvasComponents[] = [
  { canvasId: 'c1', canvasName: 'Home', components: [component('Button'), component('Card')] },
  { canvasId: 'c2', canvasName: 'Checkout', components: [component('Price')] }
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
