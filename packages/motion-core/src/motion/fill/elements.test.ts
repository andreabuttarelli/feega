import { describe, expect, it } from 'vitest';
import { COMPONENTS } from '../components';
import { FILLED, elementFills, fillReplaces } from './elements';
import { fillsSchema } from './model';

describe('which elements take a fill stack', () => {
  it('boxes, ellipses, paths and text do', () => {
    expect(Object.keys(FILLED).sort()).toEqual(['Caption', 'Kicker', 'Shape', 'Text', 'Title']);
  });

  it('every filled component stores fills in its schema', () => {
    for (const component of Object.keys(FILLED)) {
      expect({ component, has: 'fills' in COMPONENTS[component as keyof typeof COMPONENTS].schema.shape }).toEqual({ component, has: true });
    }
  });

  it('a text from before reads its colour as one solid layer', () => {
    expect(elementFills('Title', { color: 'brand.text' })).toEqual(fillsSchema.parse([{ type: 'solid', color: 'brand.text' }]));
  });

  it('a shape from before reads its legacy fill', () => {
    expect(elementFills('Shape', { fillKind: 'none' })).toEqual([]);
  });

  it('a stored stack wins', () => {
    expect(elementFills('Text', { color: '#ff0000', fills: [{ type: 'solid', color: '#00ff00' }] })).toEqual(fillsSchema.parse([{ type: 'solid', color: '#00ff00' }]));
  });

  it('the stack replaces the single-colour fields in Properties', () => {
    expect(fillReplaces('Shape', 'fillKind')).toBe(true);
    expect(fillReplaces('Shape', 'gradientAngle')).toBe(true);
    expect(fillReplaces('Title', 'color')).toBe(true);
    expect(fillReplaces('Caption', 'background')).toBe(false);
    expect(fillReplaces('Image', 'fit')).toBe(false);
  });
});
