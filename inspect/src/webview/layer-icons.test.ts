import { describe, expect, it } from 'vitest';
import { LayerIcon, ICON_SVG, iconOf } from './layer-icons';

const node = (tag: string, display = 'block', direction = 'row', extra: { component?: boolean; count?: number } = {}) => ({ tag, display, direction, component: false, count: 1, ...extra });

describe('iconOf', () => {
  it('the Head group keeps the code icon whatever its count', () => {
    expect(iconOf(node('head', 'none', 'row', { count: 3 }))).toBe(LayerIcon.Head);
  });

  it('reads flex direction and grid from the computed display', () => {
    expect(iconOf(node('div', 'flex', 'row'))).toBe(LayerIcon.FlexRow);
    expect(iconOf(node('div', 'flex', 'column'))).toBe(LayerIcon.FlexColumn);
    expect(iconOf(node('section', 'grid'))).toBe(LayerIcon.Grid);
    expect(iconOf(node('div'))).toBe(LayerIcon.Block);
  });

  it('headings get their level', () => {
    expect(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((t) => iconOf(node(t)))).toEqual([LayerIcon.H1, LayerIcon.H2, LayerIcon.H3, LayerIcon.H4, LayerIcon.H5, LayerIcon.H6]);
  });

  it('a tag icon wins over the layout; a loop shows repeat; a component root wins over both', () => {
    expect(iconOf(node('nav', 'flex'))).toBe(LayerIcon.Nav);
    expect(iconOf(node('li', 'block', 'row', { count: 3 }))).toBe(LayerIcon.Repeat);
    expect(iconOf(node('div', 'flex', 'row', { component: true }))).toBe(LayerIcon.Component);
    expect(iconOf(node('div', 'flex', 'row', { component: true, count: 3 }))).toBe(LayerIcon.Component);
  });

  it('every icon has an svg body', () => {
    expect(Object.values(LayerIcon).every((icon) => ICON_SVG[icon].length > 0)).toBe(true);
  });
});
