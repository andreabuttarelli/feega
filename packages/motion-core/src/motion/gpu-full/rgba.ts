export type Rgba = [number, number, number, number];

const BYTE = 255;
const TRANSPARENT: Rgba = [0, 0, 0, 0];
const HEX = /^#([0-9a-f]{3,8})$/i;
const FUNCTIONAL = /^rgba?\(([^)]+)\)$/i;

function fromHex(digits: string): Rgba | null {
  const full = digits.length <= 4 ? [...digits].map((d) => d + d).join('') : digits;
  if (full.length !== 6 && full.length !== 8) {
    return null;
  }
  const bytes = full.match(/../g)!.map((b) => parseInt(b, 16) / BYTE);
  return [bytes[0], bytes[1], bytes[2], bytes[3] ?? 1];
}

function fromFunctional(args: string): Rgba {
  const parts = args.split(/[\s,/]+/).filter(Boolean);
  const channel = (v: string) => (v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v) / BYTE);
  const alpha = parts[3] === undefined ? 1 : parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
  return [channel(parts[0]), channel(parts[1]), channel(parts[2]), alpha];
}

export function rgbaOf(css: string): Rgba | null {
  const value = css.trim();
  if (value === 'transparent') {
    return TRANSPARENT;
  }
  const hex = HEX.exec(value);
  if (hex) {
    return fromHex(hex[1]);
  }
  const fn = FUNCTIONAL.exec(value);
  return fn ? fromFunctional(fn[1]) : null;
}
