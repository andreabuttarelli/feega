import type { SvgNode } from '../effects/registry';

export type CssFunction = { name: string; args: string[] };

export enum FilterKind {
  Css = 'css',
  Svg = 'svg'
}

export type Filter = { kind: FilterKind.Css; fns: CssFunction[] } | { kind: FilterKind.Svg; nodes: SvgNode[] };

export type Linear = [number, number, number, number];

export const IDENTITY_MATRIX = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

export const PRIMITIVES = new Set(['feColorMatrix', 'feComponentTransfer', 'feFuncR', 'feFuncG', 'feFuncB', 'feFuncA', 'feGaussianBlur', 'feOffset', 'feComposite', 'feFlood', 'feMerge', 'feMergeNode', 'feMorphology', 'feDropShadow', 'feBlend', 'feDiffuseLighting', 'fePointLight', 'feTurbulence', 'feTile', 'feDisplacementMap']);

const FUNCTION = /([a-z-]+)\(((?:[^()]|\([^()]*\))*)\)/g;
const ARGS = /\s+(?![^(]*\))/;
const DEG = Math.PI / 180;

export function cssFunctions(filter: string): CssFunction[] {
  return [...filter.matchAll(FUNCTION)].map((m) => ({ name: m[1], args: m[2].trim().split(ARGS).filter(Boolean) }));
}

const rows = (r: number[], g: number[], b: number[]) => [...r, 0, 0, ...g, 0, 0, ...b, 0, 0, 0, 0, 0, 1, 0];

const MATRICES: Record<string, (a: number) => number[]> = {
  brightness: (b) => [b, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, 1, 0],
  contrast: (c) => [c, 0, 0, 0, 0.5 - 0.5 * c, 0, c, 0, 0, 0.5 - 0.5 * c, 0, 0, c, 0, 0.5 - 0.5 * c, 0, 0, 0, 1, 0],
  grayscale: (a) => {
    const k = 1 - Math.min(1, a);
    return rows([0.2126 + 0.7874 * k, 0.7152 - 0.7152 * k, 0.0722 - 0.0722 * k], [0.2126 - 0.2126 * k, 0.7152 + 0.2848 * k, 0.0722 - 0.0722 * k], [0.2126 - 0.2126 * k, 0.7152 - 0.7152 * k, 0.0722 + 0.9278 * k]);
  },
  saturate: (s) => rows([0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s], [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s], [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s]),
  'hue-rotate': (deg) => {
    const c = Math.cos(deg * DEG);
    const s = Math.sin(deg * DEG);
    return rows(
      [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928],
      [0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283],
      [0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072]
    );
  }
};

export const cssMatrix = (name: string, amount: number): number[] | null => MATRICES[name]?.(amount) ?? null;

export function tableAt(values: number[], c: number): number {
  const n = values.length - 1;
  if (n <= 0) {
    return values[0] ?? c;
  }
  const k = Math.min(n - 1, Math.floor(c * n));
  return values[k] + (c * n - k) * (values[k + 1] - values[k]);
}

const flatNodes = (nodes: SvgNode[]): SvgNode[] => nodes.flatMap((n) => [n, ...flatNodes(n.children ?? [])]);

export function unsupportedPrimitive(filters: SvgNode[]): string | null {
  return flatNodes(filters.flatMap((f) => f.children ?? [])).find((n) => !PRIMITIVES.has(n.tag))?.tag ?? null;
}
