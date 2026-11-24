import { describe, expect, it } from 'vitest';
import { ControlKind, VARIANT_CAP, controlsOf, variantsOf, type PropControl } from './prop-controls';

const select = (name: string, options: string[]): PropControl => ({ name, kind: ControlKind.Select, options });
const toggle = (name: string): PropControl => ({ name, kind: ControlKind.Toggle });

describe('controlsOf', () => {
  it('keeps the documented controls in order', () => {
    const documented = [select('size', ['sm', 'lg']), toggle('disabled')];

    expect(controlsOf(documented, {})).toEqual(documented);
  });

  it('adds a control for a prop the page passes that the source did not describe', () => {
    const out = controlsOf([], { name: 'Pro', featured: true, seats: 3, children: 'Buy' });

    expect(out).toEqual([{ name: 'name', kind: ControlKind.Text }, { name: 'featured', kind: ControlKind.Toggle }, { name: 'seats', kind: ControlKind.Number }, { name: 'children', kind: ControlKind.Children }]);
  });

  it('does not add one for objects, arrays and callbacks', () => {
    expect(controlsOf([], { theme: { a: 1 }, items: [1], onClick: { $fn: true } })).toEqual([]);
  });

  it('does not repeat a documented prop', () => {
    expect(controlsOf([toggle('disabled')], { disabled: true })).toHaveLength(1);
  });

  it('works with no documentation at all', () => {
    expect(controlsOf(null, { label: 'x' })).toEqual([{ name: 'label', kind: ControlKind.Text }]);
  });
});

describe('variantsOf', () => {
  it('crosses the options of every select and the two states of every toggle', () => {
    const out = variantsOf([select('size', ['sm', 'lg']), toggle('disabled')]);

    expect(out.variants).toHaveLength(4);
    expect(out.variants![0]).toEqual({ label: 'size=sm · disabled=false', props: { size: 'sm', disabled: false } });
    expect(out.dropped).toEqual([]);
    expect(out.total).toBe(4);
  });

  it('has no variants for a component with nothing to vary', () => {
    expect(variantsOf([{ name: 'label', kind: ControlKind.Text }]).variants).toBeNull();
  });

  it('stops at the cap and names the props it dropped', () => {
    const out = variantsOf([select('variant', ['a', 'b', 'c']), select('size', ['sm', 'md', 'lg']), toggle('loading'), toggle('disabled'), toggle('block')]);

    expect(out.variants!.length).toBeLessThanOrEqual(VARIANT_CAP);
    expect(out.variants).toHaveLength(18);
    expect(out.dropped).toEqual(['disabled', 'block']);
    expect(out.total).toBe(72);
  });
});
