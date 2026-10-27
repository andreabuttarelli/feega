export type NumberStyle = { decimals?: number; group?: string; point?: string };

export function fixedFormat() {
  const COMPACT: [number, string][] = [
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K']
  ];

  const number = (n: number, style: NumberStyle = {}) => {
    const { decimals = 0, group = ',', point = '.' } = style;
    const [whole, fraction] = Math.abs(n).toFixed(decimals).split('.');
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, group);
    return `${n < 0 ? '-' : ''}${grouped}${fraction ? point + fraction : ''}`;
  };

  const compact = (n: number, style: NumberStyle = {}) => {
    const step = COMPACT.find(([size]) => Math.abs(n) >= size);
    if (!step) {
      return number(n, style);
    }
    const decimals = style.decimals ?? 1;
    const short = Number((Math.abs(n) / step[0]).toFixed(decimals));
    return number(Math.sign(n) * short, { ...style, decimals: Number.isInteger(short) ? 0 : decimals }) + step[1];
  };

  const percent = (ratio: number, style: NumberStyle = {}) => `${number(ratio * 100, style)}%`;

  return { number, compact, percent };
}
