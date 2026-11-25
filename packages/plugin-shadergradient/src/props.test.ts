import { describe, expect, it } from 'vitest';
import { Control } from '@feega/plugin-api/protocol';
import { gradientAt, treeOf, writeOf } from './props';

const PAGE = `export default function Page() {
  return (
    <section className="hero">
      <ShaderGradientBackground type="sphere" color1="#112233" animate="off" uSpeed={0.3} uDensity={density} />
    </section>
  );
}
`;

const HERO = { file: 'src/Page.tsx', line: 3, col: 5 };
const OTHER = `<div>
  <h1>Hi</h1>
  <ShaderGradient type="plane" />
</div>
`;

describe('gradientAt', () => {
  it('finds the gradient inside the selected element and reads its props', () => {
    const found = gradientAt(PAGE, HERO);
    expect(found?.tag).toBe('ShaderGradientBackground');
    expect(found?.values).toMatchObject({ type: 'sphere', color1: '#112233', animate: 'off', uSpeed: '0.3' });
    expect(found?.bound).toEqual(['uDensity']);
  });

  it('finds a ShaderGradient used directly', () => {
    expect(gradientAt(OTHER, { file: 'a.tsx', line: 1, col: 1 })?.tag).toBe('ShaderGradient');
  });

  it('does not take a gradient outside the selected element', () => {
    expect(gradientAt(OTHER, { file: 'a.tsx', line: 2, col: 3 })).toBeNull();
  });

  it('is null when the position is not a tag', () => {
    expect(gradientAt(PAGE, { file: 'a.tsx', line: 1, col: 1 })).toBeNull();
  });
});

describe('treeOf', () => {
  const found = gradientAt(PAGE, HERO)!;
  const tree = treeOf(found);

  it('shows colours as colour fields and numbers as sliders, with the value in the source', () => {
    expect(tree).toContainEqual(expect.objectContaining({ type: Control.Colour, id: 'color1', value: '#112233' }));
    expect(tree).toContainEqual(expect.objectContaining({ type: Control.Slider, id: 'uSpeed', value: 0.3 }));
    expect(tree).toContainEqual(expect.objectContaining({ type: Control.Toggle, id: 'animate', value: false }));
    expect(tree).toContainEqual(expect.objectContaining({ type: Control.Select, id: 'type', value: 'sphere' }));
  });

  it('falls back to the default for a prop that is not written', () => {
    expect(tree).toContainEqual(expect.objectContaining({ id: 'color2', value: '#dbba95' }));
  });

  it('leaves out a prop bound to an expression and says so', () => {
    expect(tree.some((node) => 'id' in node && node.id === 'uDensity')).toBe(false);
    expect(tree).toContainEqual(expect.objectContaining({ type: Control.Note, text: expect.stringContaining('uDensity') }));
  });
});

describe('writeOf', () => {
  it('writes a number as a number', () => {
    expect(writeOf('uSpeed', 0.5)).toEqual({ set: {}, numbers: { uSpeed: 0.5 } });
  });

  it('writes a colour and a choice as strings', () => {
    expect(writeOf('color1', '#ffffff')).toEqual({ set: { color1: '#ffffff' }, numbers: {} });
    expect(writeOf('type', 'waterPlane')).toEqual({ set: { type: 'waterPlane' }, numbers: {} });
  });

  it('writes a switch as on or off', () => {
    expect(writeOf('grain', true)).toEqual({ set: { grain: 'on' }, numbers: {} });
    expect(writeOf('animate', false)).toEqual({ set: { animate: 'off' }, numbers: {} });
  });

  it('writes nothing for a prop it does not know', () => {
    expect(writeOf('onClick', 'x')).toBeNull();
  });
});
