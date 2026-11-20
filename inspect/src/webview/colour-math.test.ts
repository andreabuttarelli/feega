import { describe, expect, it } from 'vitest';
import { ColourFormat, formatColour, hexToHsv, hsvToHex, parseRgba, rgbaCss } from './colour-math';

describe('colour math', () => {
  it('hex and hsv round-trip', () => {
    for (const hex of ['#0078d4', '#ffcc00', '#000000', '#ffffff', '#7f3fbf']) {
      expect(hsvToHex(hexToHsv(hex))).toBe(hex);
    }
  });

  it('parses rgb, rgba and hex with alpha', () => {
    expect(parseRgba('rgba(0, 120, 212, 0.5)')).toEqual({ r: 0, g: 120, b: 212, a: 0.5 });
    expect(parseRgba('#0078d480')).toEqual({ r: 0, g: 120, b: 212, a: 0.502 });
    expect(parseRgba('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
  });

  it('writes opaque colours as hex and translucent ones as rgba', () => {
    expect(rgbaCss({ r: 0, g: 120, b: 212, a: 1 })).toBe('#0078d4');
    expect(rgbaCss({ r: 0, g: 120, b: 212, a: 0.5 })).toBe('rgba(0, 120, 212, 0.5)');
  });

  it('shows a colour in each format', () => {
    const c = { r: 0, g: 120, b: 212, a: 1 };
    expect(formatColour(c, ColourFormat.Hex)).toBe('#0078D4');
    expect(formatColour(c, ColourFormat.Rgb)).toBe('0, 120, 212');
    expect(formatColour(c, ColourFormat.Hsl)).toBe('206, 100%, 42%');
    expect(formatColour(c, ColourFormat.Oklch).startsWith('0.5')).toBe(true);
  });
});
