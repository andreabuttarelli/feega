import { describe, expect, it } from 'vitest';
import { Group, groupDeclarations, isColour } from './dev-groups';

describe('dev groups', () => {
  it('sorts declarations into ordered groups and drops the size ones', () => {
    const groups = groupDeclarations([['width', '10px'], ['font-size', '12px'], ['display', 'flex'], ['background', '#fff']]);

    expect(groups.map(([g]) => g)).toEqual([Group.Layout, Group.Typography, Group.Fill]);
    expect(groups[0][1]).toEqual([{ property: 'display', value: 'flex', swatch: false }]);
  });

  it('gives colour values a swatch', () => {
    expect(isColour('#0099ff')).toBe(true);
    expect(isColour('rgba(0, 0, 0, 0.4)')).toBe(true);
    expect(isColour('480px')).toBe(false);
  });
});
