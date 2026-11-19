const RGB = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/;
const HEX = /^#[0-9a-f]{6}$/i;
const BLACK = '#000000';
const NO_PAINT = 'transparent';

const byte = (n: string) => Number(n).toString(16).padStart(2, '0');

export function hexOf(css: string): string {
  if (HEX.test(css)) {
    return css.toLowerCase();
  }
  const m = css.match(RGB);
  return m ? `#${byte(m[1])}${byte(m[2])}${byte(m[3])}` : BLACK;
}

export function paintOf(css: string): string | null {
  const m = css.match(RGB);
  if (css.trim() === NO_PAINT || (m && m[4] !== undefined && Number(m[4]) === 0)) {
    return null;
  }
  return hexOf(css);
}
