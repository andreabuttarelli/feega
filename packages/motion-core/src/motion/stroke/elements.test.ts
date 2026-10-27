import { describe, expect, it } from 'vitest';
import { COMPONENTS } from '../components';
import { STROKED, elementStrokes, strokeReplaces } from './elements';
import { strokesSchema } from './model';

describe('which elements take a stroke stack', () => {
  it('shapes, paths and text do', () => {
    expect(Object.keys(STROKED).sort()).toEqual(['Caption', 'Kicker', 'Shape', 'Text', 'Title']);
  });

  it('every stroked component stores strokes in its schema', () => {
    for (const component of Object.keys(STROKED)) {
      expect({ component, has: 'strokes' in COMPONENTS[component as keyof typeof COMPONENTS].schema.shape }).toEqual({ component, has: true });
    }
  });

  it('a text from before has no stroke', () => {
    expect(elementStrokes('Title', { color: '#ffffff' })).toEqual([]);
  });

  it('a shape from before reads its legacy stroke', () => {
    expect(elementStrokes('Shape', { strokeKind: 'solid', stroke: '#111111' })).toEqual(strokesSchema.parse([{ paint: { type: 'solid', color: '#111111' } }]));
  });

  it('the stack replaces the single stroke fields of a shape in Properties', () => {
    for (const key of ['strokeKind', 'stroke', 'strokeWidth', 'dash', 'gap', 'cap', 'join']) {
      expect({ key, hidden: strokeReplaces('Shape', key) }).toEqual({ key, hidden: true });
    }
    expect(strokeReplaces('Shape', 'fillRule')).toBe(false);
    expect(strokeReplaces('Title', 'color')).toBe(false);
  });
});
