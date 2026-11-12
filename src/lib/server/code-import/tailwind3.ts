import { LIGHT, type Declared } from './css-tokens';

type Theme = Record<string, unknown>;

type Scale = { key: string; prefix: string; utilities: string[] };

const SCALES: Scale[] = [
  { key: 'colors', prefix: '--color', utilities: ['bg', 'text', 'border'] },
  { key: 'spacing', prefix: '--spacing', utilities: ['p', 'gap'] },
  { key: 'borderRadius', prefix: '--radius', utilities: ['rounded'] },
  { key: 'fontFamily', prefix: '--font', utilities: ['font'] },
  { key: 'fontSize', prefix: '--text', utilities: ['text'] },
  { key: 'boxShadow', prefix: '--shadow', utilities: ['shadow'] },
  { key: 'screens', prefix: '--breakpoint', utilities: [] }
];

const DEFAULT_KEY = 'DEFAULT';
const LINE_HEIGHT = '--line-height';
const LENGTH = /^(\d*\.?\d+)(rem|px)$/;

function lineHeightOf(size: string, lineHeight: string): string {
  const [s, l] = [LENGTH.exec(size), LENGTH.exec(lineHeight)];
  return s && l && s[2] === l[2] ? `calc(${l[1]} / ${s[1]})` : lineHeight;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const themeOf = (config: unknown): Theme | null => (isObject(config) && isObject(config.theme) ? config.theme : null);

const joined = (path: string[]) => path.filter((p) => p !== DEFAULT_KEY).join('-');

type Leaf = { path: string[]; raw: string; lineHeight?: string };

function leaves(value: unknown, path: string[]): Leaf[] {
  if (typeof value === 'string') {
    return [{ path, raw: value }];
  }
  if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
    return [{ path, raw: value.join(', ') }];
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    const options = value[1];
    const lineHeight = typeof options === 'string' ? options : isObject(options) && typeof options.lineHeight === 'string' ? options.lineHeight : undefined;
    return [{ path, raw: value[0], ...(lineHeight ? { lineHeight } : {}) }];
  }
  return isObject(value) ? Object.entries(value).flatMap(([k, v]) => leaves(v, [...path, k])) : [];
}

const nameOf = (scale: Scale, path: string[]) => (joined(path) ? `${scale.prefix}-${joined(path)}` : scale.prefix);

export function configTokens(config: unknown, file: string): Declared[] {
  const theme = themeOf(config);
  if (!theme) {
    return [];
  }
  const at = { file, line: 1, column: 0 };
  return SCALES.flatMap((scale) =>
    leaves(theme[scale.key], []).flatMap((leaf) => {
      const name = nameOf(scale, leaf.path);
      const own: Declared = { name, raw: leaf.raw, mode: LIGHT, at };
      return leaf.lineHeight ? [own, { name: `${name}${LINE_HEIGHT}`, raw: lineHeightOf(leaf.raw, leaf.lineHeight), mode: LIGHT, at }] : [own];
    })
  );
}

export function classTokens(config: unknown): Map<string, string> {
  const theme = themeOf(config);
  const map = new Map<string, string>();
  for (const scale of theme ? SCALES : []) {
    for (const leaf of leaves(theme![scale.key], [])) {
      const suffix = joined(leaf.path);
      scale.utilities.forEach((u) => map.set(suffix ? `${u}-${suffix}` : u, nameOf(scale, leaf.path)));
    }
  }
  return map;
}
