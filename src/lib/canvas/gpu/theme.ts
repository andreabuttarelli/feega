export type Theme = { canvas: string; dot: string; paper: string; line: string; ink: string; inkSoft: string; accent: string; iterate: string; wire: string; font: string };

const WIRE_INK_SHARE = 0.45;
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function channels(colour: string): number[] | null {
  const m = HEX.exec(colour.trim());
  if (!m) {
    return null;
  }
  const hex = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

export function mix(a: string, b: string, share: number): string {
  const ca = channels(a);
  const cb = channels(b);
  if (!ca || !cb) {
    return a;
  }
  return `#${ca.map((v, i) => Math.round(v * share + cb[i] * (1 - share)).toString(16).padStart(2, '0')).join('')}`;
}

export function themeOf(el: HTMLElement): Theme {
  const css = getComputedStyle(el);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    canvas: v('--ui-canvas', '#ebebeb'),
    dot: v('--ui-canvas-dot', '#c8c8c8'),
    paper: v('--paper', '#ffffff'),
    line: v('--line', '#e5e5e5'),
    ink: v('--ink', '#1d1d1f'),
    inkSoft: v('--ink-soft', '#6e6e73'),
    accent: v('--accent', '#7c5cff'),
    iterate: v('--ui-wire-iterate', '#d97706'),
    wire: mix(v('--ink-soft', '#6e6e73'), v('--paper', '#ffffff'), WIRE_INK_SHARE),
    font: (v('--sans', 'DM Sans').split(',')[0] || 'DM Sans').replace(/['"]/g, '').trim()
  };
}
