import { describe, expect, it } from 'vitest';
import { LayerIcon, ICON_SVG, iconOf, floatingOf, Floating, FLOAT_HINT } from './layer-icons';

const node = (tag: string, display = 'block', direction = 'row', extra: { component?: boolean; count?: number; position?: string } = {}) => ({ tag, display, direction, component: false, count: 1, position: 'static', ...extra });

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

describe('floating layers', () => {
  it('absolute and fixed get the floating icon over layout and tag icons', () => {
    expect(iconOf(node('div', 'flex', 'row', { position: 'absolute' }))).toBe(LayerIcon.Floating);
    expect(iconOf(node('nav', 'block', 'row', { position: 'fixed' }))).toBe(LayerIcon.Floating);
  });

  it('relative, sticky and static keep their usual icon', () => {
    expect(iconOf(node('div', 'flex', 'row', { position: 'relative' }))).toBe(LayerIcon.FlexRow);
    expect(iconOf(node('div', 'flex', 'row', { position: 'sticky' }))).toBe(LayerIcon.FlexRow);
    expect(iconOf(node('div'))).toBe(LayerIcon.Block);
  });

  it('a component root and a loop keep their icon', () => {
    expect(iconOf(node('div', 'block', 'row', { position: 'absolute', component: true }))).toBe(LayerIcon.Component);
    expect(iconOf(node('li', 'block', 'row', { position: 'absolute', count: 2 }))).toBe(LayerIcon.Repeat);
  });

  it('the tag names absolute, fixed and sticky only', () => {
    expect(['absolute', 'fixed', 'sticky', 'relative', 'static', ''].map(floatingOf)).toEqual([Floating.Absolute, Floating.Fixed, Floating.Sticky, null, null, null]);
  });

  it('every position badge explains itself on hover', () => {
    expect(Object.values(Floating).map((f) => FLOAT_HINT[f])).toEqual([
      'Absolute: placed relative to its nearest positioned parent',
      'Fixed: stays in place on the screen while the page scrolls',
      'Sticky: scrolls with the page, then sticks at its offset'
    ]);
  });
});
