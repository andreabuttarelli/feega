export const AUTO = 'auto';

export type Leading = number | typeof AUTO;

export const LINE_HEIGHT = /^(auto|\d+(\.\d+)?(px|%))?$/;
export const LETTER_SPACING = /^(-?\d+(\.\d+)?(px|%))?$/;

const MEASURE = /^(-?\d+(?:\.\d+)?)(px|%)$/;
const PERCENT = 100;

type Measured = Record<string, unknown> & { lineHeight?: unknown; letterSpacing?: unknown; leading?: unknown; tracking?: unknown };

function emOf(value: unknown, sizePx: number): number | null {
  const match = MEASURE.exec(String(value ?? ''));
  if (!match) {
    return null;
  }
  return match[2] === 'px' ? Number(match[1]) / sizePx : Number(match[1]) / PERCENT;
}

export function leadingOf(p: Measured, sizePx: number): Leading {
  if (p.lineHeight === AUTO) {
    return AUTO;
  }
  return emOf(p.lineHeight, sizePx) ?? Number(p.leading ?? 1);
}

export const trackingOf = (p: Measured, sizePx: number): number => emOf(p.letterSpacing, sizePx) ?? Number(p.tracking ?? 0);

export const CSS_NORMAL = 'normal';
export const CSS_AUTO = 'auto';
export const CAP_TRIM_CSS = 'trim-both cap alphabetic';

export function measured<P extends Measured>(p: P, sizePx: number): P {
  const tracking = emOf(p.letterSpacing, sizePx);
  const leading = leadingOf(p, sizePx);
  return { ...p, ...(tracking === null ? {} : { tracking }), ...(p.lineHeight ? { leading: leading === AUTO ? CSS_NORMAL : leading } : {}) };
}
