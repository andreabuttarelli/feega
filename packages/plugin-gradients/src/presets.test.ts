import { describe, expect, it } from 'vitest';
import { Kind, PRESETS, kindOf } from './presets';

const HEX = /#[0-9a-f]{6}/gi;

describe('gradient presets', () => {
  it('holds between 30 and 40 presets', () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(30);
    expect(PRESETS.length).toBeLessThanOrEqual(40);
  });

  it('gives every preset its own id and name', () => {
    expect(new Set(PRESETS.map((preset) => preset.id)).size).toBe(PRESETS.length);
    expect(new Set(PRESETS.map((preset) => preset.name)).size).toBe(PRESETS.length);
  });

  it('covers linear, radial and conic gradients, each with a real share', () => {
    for (const kind of Object.values(Kind)) {
      expect(PRESETS.filter((preset) => kindOf(preset) === kind).length).toBeGreaterThanOrEqual(8);
    }
  });

  it('is one complete css gradient per preset, made only of hex colours', () => {
    for (const preset of PRESETS) {
      expect(preset.css).toMatch(/^(linear|radial|conic)-gradient\([^()]+\)$/);
      expect(preset.css.replace(HEX, '').match(/#/)).toBeNull();
      expect((preset.css.match(HEX) ?? []).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('stays subtle: no preset mixes more than five colours', () => {
    expect(PRESETS.every((preset) => (preset.css.match(HEX) ?? []).length <= 5)).toBe(true);
  });
});
