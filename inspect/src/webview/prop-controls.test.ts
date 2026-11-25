import { describe, expect, it } from 'vitest';
import { ControlKind, EDITORS, INVALID, VARIANT_CAP, controlsOf, variantsOf, type PropControl } from './prop-controls';

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

  it('adds a control for objects, arrays and callbacks the page passes', () => {
    expect(controlsOf([], { theme: { a: 1 }, items: [1], onClick: { $fn: true } })).toEqual([
      { name: 'theme', kind: ControlKind.Object },
      { name: 'items', kind: ControlKind.Array },
      { name: 'onClick', kind: ControlKind.Callback }
    ]);
  });

  it('adds a date for a date mark', () => {
    expect(controlsOf([], { when: { $date: '2026-01-01T00:00:00.000Z' } })).toEqual([{ name: 'when', kind: ControlKind.Date }]);
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

describe('variantsOf with richer kinds', () => {
  it('varies a numeric select by its numbers', () => {
    const out = variantsOf([{ name: 'cols', kind: ControlKind.Select, options: [1, 2] }]);

    expect(out.variants!.map((variant) => variant.props)).toEqual([{ cols: 1 }, { cols: 2 }]);
  });

  it('does not vary arrays, objects or callbacks', () => {
    expect(variantsOf([{ name: 'a', kind: ControlKind.Array }, { name: 'b', kind: ControlKind.Object }, { name: 'c', kind: ControlKind.Callback }]).variants).toBeNull();
  });
});

describe('EDITORS', () => {
  it('has one editor for every kind', () => {
    expect(Object.keys(EDITORS).sort()).toEqual(Object.values(ControlKind).sort());
  });

  it('gives a numeric option back as a number', () => {
    const control: PropControl = { name: 'cols', kind: ControlKind.Select, options: [1, 2] };

    expect(EDITORS[ControlKind.Select].read('2', control)).toBe(2);
    expect(EDITORS[ControlKind.Select].show(2, control)).toBe('2');
  });

  it('edits arrays and objects as JSON', () => {
    const control: PropControl = { name: 'items', kind: ControlKind.Array };

    expect(EDITORS[ControlKind.Array].show(['a'], control)).toBe('[\n  "a"\n]');
    expect(EDITORS[ControlKind.Array].read('["b"]', control)).toEqual(['b']);
    expect(EDITORS[ControlKind.Object].read('{"a":1}', { name: 'o', kind: ControlKind.Object })).toEqual({ a: 1 });
  });

  it('flags JSON that does not parse and JSON of the wrong shape', () => {
    expect(EDITORS[ControlKind.Array].read('[1', { name: 'items', kind: ControlKind.Array })).toBe(INVALID);
    expect(EDITORS[ControlKind.Array].read('{"a":1}', { name: 'items', kind: ControlKind.Array })).toBe(INVALID);
    expect(EDITORS[ControlKind.Object].read('[1]', { name: 'o', kind: ControlKind.Object })).toBe(INVALID);
  });

  it('keeps a date as a mark the page can revive', () => {
    const control: PropControl = { name: 'when', kind: ControlKind.Date };

    expect(EDITORS[ControlKind.Date].read('2026-03-04', control)).toEqual({ $date: '2026-03-04T00:00:00.000Z' });
    expect(EDITORS[ControlKind.Date].show({ $date: '2026-03-04T00:00:00.000Z' }, control)).toBe('2026-03-04');
    expect(EDITORS[ControlKind.Date].read('', control)).toBeUndefined();
  });

  it('shows a callback as read-only text', () => {
    expect(EDITORS[ControlKind.Callback].readonly).toBe(true);
  });

  it('only offers the color picker a hex value it can show', () => {
    const control: PropControl = { name: 'color', kind: ControlKind.Color };

    expect(EDITORS[ControlKind.Color].swatch?.('#ff0000')).toBe('#ff0000');
    expect(EDITORS[ControlKind.Color].swatch?.('tomato')).toBe('#000000');
  });
});
