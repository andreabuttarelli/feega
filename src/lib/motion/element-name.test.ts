import { describe, expect, it } from 'vitest';
import { Direction } from '@feega/motion-core/motion/layout/auto-layout';
import { DEFAULT_AUTO_LAYOUT } from '@feega/motion-core/motion/layout/model';
import { elementName } from './element-name';

describe('what a graphic element is called', () => {
  it('names shapes by what they draw, and the rest by their component', () => {
    expect(elementName({ component: 'Shape', props: { shape: 'rect' } })).toBe('Box');
    expect(elementName({ component: 'Shape', props: { shape: 'ellipse' } })).toBe('Ellipse');
    expect(elementName({ component: 'Shape', props: { shape: 'path' } })).toBe('Path');
    expect(elementName({ component: 'Text', props: {} })).toBe('Text');
    expect(elementName({ component: 'Image', props: {} })).toBe('Image');
  });

  it('calls a saved auto layout container a Stack, and a grid a Grid', () => {
    expect(elementName({ component: 'Shape', props: { shape: 'rect' }, autoLayout: { ...DEFAULT_AUTO_LAYOUT, direction: Direction.Vertical } })).toBe('Stack');
    expect(elementName({ component: 'Shape', props: { shape: 'rect' }, autoLayout: { ...DEFAULT_AUTO_LAYOUT, direction: Direction.Grid } })).toBe('Grid');
  });
});
