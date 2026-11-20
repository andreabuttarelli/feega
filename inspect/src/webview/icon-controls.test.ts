import { describe, expect, it } from 'vitest';
import { LiveProp } from '@feega/live-edit/live-fields';
import { ROWS } from './controls';
import { iconRowNames } from './icon-controls';

const BLACK = 'rgb(0, 0, 0)';
const RED = 'rgb(255, 0, 0)';

describe('iconRowNames', () => {
  it('a stroke icon that follows the text colour is recoloured through color', () => {
    expect(iconRowNames({ color: BLACK, fill: 'none', stroke: BLACK })).toEqual(['icon-colour', 'icon-stroke-width']);
  });

  it('a stroke set on the svg itself is recoloured on the svg', () => {
    expect(iconRowNames({ color: BLACK, fill: 'none', stroke: RED })).toEqual(['icon-stroke', 'icon-stroke-width']);
  });

  it('a filled icon has a fill and no stroke width', () => {
    expect(iconRowNames({ color: BLACK, fill: RED, stroke: 'none' })).toEqual(['icon-fill']);
  });

  it('a filled icon that follows the colour has only the colour', () => {
    expect(iconRowNames({ color: RED, fill: RED, stroke: 'none' })).toEqual(['icon-colour']);
  });

  it('an icon with neither paint shows nothing to colour', () => {
    expect(iconRowNames({ color: BLACK, fill: 'none', stroke: 'none' })).toEqual([]);
  });
});

describe('icon rows', () => {
  const row = (name: string) => ROWS.find((r) => r.name === name)!;

  it('the colour of a currentColor icon writes color, the others write the svg property', () => {
    expect(row('icon-colour').change('#ff0000')).toEqual({ prop: LiveProp.Color, value: '#ff0000' });
    expect(row('icon-stroke').change('#ff0000')).toEqual({ prop: LiveProp.Class, family: 'arbitrary:stroke', value: '[stroke:#ff0000]' });
    expect(row('icon-stroke-width').change('1.5')).toEqual({ prop: LiveProp.Class, family: 'arbitrary:stroke-width', value: '[stroke-width:1.5]' });
  });
});
