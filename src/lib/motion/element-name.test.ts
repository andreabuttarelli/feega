import { describe, expect, it } from 'vitest';
import { Direction } from '@feega/motion-core/motion/layout/auto-layout';
import { DEFAULT_AUTO_LAYOUT } from '@feega/motion-core/motion/layout/model';
import { elementKind, elementName, layerKind, layerLabel } from './element-name';

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

describe('what a group is called', () => {
  it('is a Group, not the box it is drawn with', () => {
    expect(elementName({ component: 'Shape', props: { shape: 'rect' }, group: true })).toBe('Group');
    expect(elementKind({ component: 'Shape', props: { shape: 'rect' }, group: true })).toBe('Group');
  });

  it('keeps the component as the kind of anything else', () => {
    expect(elementKind({ component: 'Shape', props: { shape: 'rect' } })).toBe('Shape');
    expect(elementKind({ component: 'Shape', props: { shape: 'rect' }, autoLayout: { ...DEFAULT_AUTO_LAYOUT, direction: Direction.Vertical } })).toBe('Stack');
  });
});

describe('one name for a layer, in Layers and in Properties', () => {
  const comps = { main: { name: 'Button', component: { id: 'main' } }, plain: { name: 'Intro' } };

  it('a name the user typed wins', () => {
    expect(layerLabel({ component: 'Shape', name: 'Card', props: { shape: 'rect' } }, comps)).toBe('Card');
  });

  it('a text layer is named by its first line', () => {
    expect(layerLabel({ component: 'Text', props: { text: 'Ship faster\nsecond line' } }, comps)).toBe('Ship faster');
  });

  it('a shape by what it draws, never the component name', () => {
    expect(layerLabel({ component: 'Shape', props: { shape: 'rect' } }, comps)).toBe('Box');
  });

  it('an instance by its main component', () => {
    expect(layerLabel({ component: 'Precomp', props: { comp: 'main' } }, comps)).toBe('Button');
  });

  it('the kind under the name says what an instance is an instance of', () => {
    expect(layerKind({ component: 'Precomp', props: { comp: 'main' } }, comps)).toBe('Instance of Button');
    expect(layerKind({ component: 'Precomp', props: { comp: 'plain' } }, comps)).toBe('Precomp');
    expect(layerKind({ component: 'Shape', props: { shape: 'rect' } }, comps)).toBe('Shape');
  });
});
