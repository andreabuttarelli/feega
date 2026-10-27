import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, parseMotionDoc, findClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, setProps, type OpResult } from '@feega/motion-core/motion/timeline';
import { setAutoLayout } from './layout/ops';
import { VarType } from '@feega/motion-core/motion/variables-model';
import { addMode, bindVariable, bindableTargets, defineVariable, removeVariable, resolveVariables, setActiveMode, unbindVariable } from './variables';

function ok(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

function docWith(): MotionDoc {
  const base = newMotionDoc(MotionFormat.Square);
  const shape = ok(addClip(base, { component: 'Shape', from: 0, props: { shape: 'rect' } }, 's1'));
  return ok(addClip(shape, { component: 'Title', from: 0, props: {} }, 't1'));
}

const SURFACE = { type: VarType.Colour, values: { Light: '#ffffff', Dark: '#101010' } } as const;

function themed(): MotionDoc {
  return ok(defineVariable(docWith(), 'Theme', 'surface', SURFACE, ['Light', 'Dark']));
}

const fillOf = (doc: MotionDoc) => findClip(doc, 's1')!.clip.props.fill;

describe('variables', () => {
  it('an old doc without variables still parses', () => {
    expect(parseMotionDoc(docWith()).ok).toBe(true);
  });

  it('binding writes the default mode value into the prop', () => {
    const doc = ok(bindVariable(themed(), 's1', 'fill', 'Theme/surface'));
    expect(fillOf(doc)).toBe('#ffffff');
    expect(findClip(doc, 's1')!.clip.bind).toEqual({ fill: 'Theme/surface' });
  });

  it('switching the mode recolours every bound clip', () => {
    const bound = ok(bindVariable(ok(bindVariable(themed(), 's1', 'fill', 'Theme/surface')), 't1', 'color', 'Theme/surface'));
    const dark = ok(setActiveMode(bound, 'Theme', 'Dark'));
    expect(fillOf(dark)).toBe('#101010');
    expect(findClip(dark, 't1')!.clip.props.color).toBe('#101010');
    expect(fillOf(ok(setActiveMode(dark, 'Theme', 'Light')))).toBe('#ffffff');
  });

  it('editing a value re-resolves the bound props', () => {
    const bound = ok(bindVariable(themed(), 's1', 'fill', 'Theme/surface'));
    const edited = ok(defineVariable(bound, 'Theme', 'surface', { type: VarType.Colour, values: { Light: '#eeeeee', Dark: '#101010' } }));
    expect(fillOf(edited)).toBe('#eeeeee');
  });

  it('a number variable binds the radius of a shape', () => {
    const doc = ok(defineVariable(docWith(), 'Size', 'radius', { type: VarType.Number, values: { Default: 0.25 } }));
    expect(findClip(ok(bindVariable(doc, 's1', 'roundness', 'Size/radius')), 's1')!.clip.props.roundness).toBe(0.25);
  });

  it('a number variable binds auto layout gap and padding', () => {
    const laid = ok(setAutoLayout(docWith(), 's1', {}));
    const doc = ok(defineVariable(laid, 'Space', 'm', { type: VarType.Number, values: { Default: 24 } }));
    const gap = ok(bindVariable(doc, 's1', 'autoLayout.gap', 'Space/m'));
    const padded = ok(bindVariable(gap, 's1', 'autoLayout.padding', 'Space/m'));
    expect(findClip(padded, 's1')!.clip.autoLayout).toMatchObject({ gap: 24, padding: { top: 24, right: 24, bottom: 24, left: 24 } });
  });

  it('a variable of the wrong type is refused for a prop', () => {
    const r = bindVariable(themed(), 's1', 'roundness', 'Theme/surface');
    expect(r).toMatchObject({ ok: false });
  });

  it('bindable targets are filtered by type', () => {
    const clip = findClip(docWith(), 's1')!.clip;
    expect(bindableTargets(clip, VarType.Colour)).toContain('fill');
    expect(bindableTargets(clip, VarType.Number)).toContain('roundness');
    expect(bindableTargets(clip, VarType.Number)).not.toContain('fill');
  });

  it('an alias follows the target in the active mode of its collection', () => {
    const brand = ok(defineVariable(themed(), 'Brand', 'accent', { type: VarType.Colour, values: { Default: '#ff0000' } }));
    const aliased = ok(defineVariable(brand, 'Theme', 'surface', { type: VarType.Colour, values: { Light: { alias: 'Brand/accent' }, Dark: '#101010' } }));
    expect(fillOf(ok(bindVariable(aliased, 's1', 'fill', 'Theme/surface')))).toBe('#ff0000');
  });

  it('an alias cycle is refused', () => {
    const a = ok(defineVariable(docWith(), 'C', 'a', { type: VarType.Colour, values: { Default: '#000000' } }));
    const b = ok(defineVariable(a, 'C', 'b', { type: VarType.Colour, values: { Default: { alias: 'C/a' } } }));
    expect(defineVariable(b, 'C', 'a', { type: VarType.Colour, values: { Default: { alias: 'C/b' } } })).toMatchObject({ ok: false });
  });

  it('an alias to another type is refused', () => {
    const n = ok(defineVariable(docWith(), 'C', 'n', { type: VarType.Number, values: { Default: 1 } }));
    expect(defineVariable(n, 'C', 'c', { type: VarType.Colour, values: { Default: { alias: 'C/n' } } })).toMatchObject({ ok: false });
  });

  it('a value of the wrong type is refused', () => {
    expect(defineVariable(docWith(), 'C', 'n', { type: VarType.Number, values: { Default: 'x' } })).toMatchObject({ ok: false });
  });

  it('a mode with no value is refused', () => {
    expect(defineVariable(docWith(), 'C', 'n', { type: VarType.Number, values: { Light: 1 } }, ['Light', 'Dark'])).toMatchObject({ ok: false });
  });

  it('an unknown mode is refused', () => {
    expect(setActiveMode(themed(), 'Theme', 'Neon')).toMatchObject({ ok: false });
  });

  it('unbinding keeps the last value and drops the link', () => {
    const dark = ok(setActiveMode(ok(bindVariable(themed(), 's1', 'fill', 'Theme/surface')), 'Theme', 'Dark'));
    const free = ok(unbindVariable(dark, 's1', 'fill'));
    expect(findClip(free, 's1')!.clip.bind).toBeUndefined();
    expect(fillOf(ok(setActiveMode(free, 'Theme', 'Light')))).toBe('#101010');
  });

  it('removing a variable unbinds its clips, keeping their value', () => {
    const bound = ok(bindVariable(themed(), 's1', 'fill', 'Theme/surface'));
    const gone = ok(removeVariable(bound, 'Theme', 'surface'));
    expect(findClip(gone, 's1')!.clip.bind).toBeUndefined();
    expect(fillOf(gone)).toBe('#ffffff');
  });

  it('set_props refuses a bound target', () => {
    const bound = ok(bindVariable(themed(), 's1', 'fill', 'Theme/surface'));
    expect(setProps(bound, 's1', { fill: '#00ff00' })).toMatchObject({ ok: false, error: expect.stringContaining('Theme/surface') });
    expect(setProps(bound, 's1', { roundness: 0.1 })).toMatchObject({ ok: true });
  });

  it('a new mode starts from the values of the default mode', () => {
    const doc = ok(addMode(themed(), 'Theme', 'Neon'));
    expect(doc.variables!.Theme.modes).toEqual(['Light', 'Dark', 'Neon']);
    expect(doc.variables!.Theme.vars.surface.values.Neon).toBe('#ffffff');
    expect(addMode(doc, 'Theme', 'Neon')).toMatchObject({ ok: false });
  });

  it('resolving twice changes nothing', () => {
    const bound = ok(bindVariable(themed(), 's1', 'fill', 'Theme/surface'));
    expect(resolveVariables(bound)).toEqual(bound);
  });
});
