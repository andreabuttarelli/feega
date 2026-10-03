import { describe, expect, it } from 'vitest';
import { COMPONENT_IDS, AssetKind, Control, Group, defaultProps } from './components';
import { fieldGroups, fieldsOf, parseDecimal, secondsLabel } from './inspector';

describe('properties inspector from the component schema', () => {
  it('every component describes every prop it takes', () => {
    for (const id of COMPONENT_IDS) {
      expect(fieldsOf(id).map((f) => f.key).sort()).toEqual(Object.keys(defaultProps(id)).sort());
    }
  });

  it('a colour is a colour picker with its default', () => {
    const color = fieldsOf('Title').find((f) => f.key === 'color');

    expect(color).toMatchObject({ control: Control.Color, fallback: 'brand.text', group: Group.Style });
  });

  it('a range carries its bounds and step', () => {
    const opacity = fieldsOf('Title').find((f) => f.key === 'opacity');

    expect(opacity).toMatchObject({ control: Control.Range, min: 0, max: 1, step: 0.01 });
  });

  it('a select carries its options', () => {
    expect(fieldsOf('Title').find((f) => f.key === 'font')?.options).toEqual(['sans', 'mono']);
  });

  it('the 3D model picker lists only 3D assets', () => {
    expect(fieldsOf('Model3D').find((f) => f.key === 'assetId')).toMatchObject({ control: Control.Asset, assetKind: AssetKind.Model3d });
  });

  it('groups come content first', () => {
    expect(fieldGroups('Title')[0].group).toBe(Group.Content);
  });

  it('seconds read rounded, with a dot, whatever the locale', () => {
    expect(secondsLabel(8)).toBe('0.27');
    expect(secondsLabel(9)).toBe('0.3');
    expect(secondsLabel(90)).toBe('3');
  });

  it('a decimal typed with a comma or a dot is the same number', () => {
    expect(parseDecimal('0,27')).toBe(0.27);
    expect(parseDecimal(' 1.5 ')).toBe(1.5);
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('')).toBeNull();
  });
});
