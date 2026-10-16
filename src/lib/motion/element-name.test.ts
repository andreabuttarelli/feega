import { describe, expect, it } from 'vitest';
import { elementName } from './element-name';

describe('what a graphic element is called', () => {
  it('names shapes by what they draw, and the rest by their component', () => {
    expect(elementName({ component: 'Shape', props: { shape: 'rect' } })).toBe('Box');
    expect(elementName({ component: 'Shape', props: { shape: 'ellipse' } })).toBe('Ellipse');
    expect(elementName({ component: 'Shape', props: { shape: 'path' } })).toBe('Path');
    expect(elementName({ component: 'Text', props: {} })).toBe('Text');
    expect(elementName({ component: 'Image', props: {} })).toBe('Image');
  });
});
