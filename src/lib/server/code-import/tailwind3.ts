import { LIGHT, type DeclAt, type Declared } from '@feega/live-edit/css-tokens';

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
const LETTER_SPACING = '--letter-spacing';
const FONT_WEIGHT = '--font-weight';

export type Place = (path: string[]) => DeclAt;
const LENGTH = /^(\d*\.?\d+)(rem|px)$/;
const CHANNEL_VAR = /^(?:hsl|rgb|oklch)a?\(\s*var\(\s*(--[\w-]+)\s*\)\s*(?:\/\s*<alpha-value>\s*)?\)$/;

const aliased = (raw: string) => (CHANNEL_VAR.test(raw.trim()) ? `var(${CHANNEL_VAR.exec(raw.trim())![1]})` : raw);

function lineHeightOf(size: string, lineHeight: string): string {
  const [s, l] = [LENGTH.exec(size), LENGTH.exec(lineHeight)];
  return s && l && s[2] === l[2] ? `calc(${l[1]} / ${s[1]})` : lineHeight;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const themeOf = (config: unknown): Theme | null => (isObject(config) && isObject(config.theme) ? config.theme : null);

const joined = (path: string[]) => path.filter((p) => p !== DEFAULT_KEY).join('-');

type Extra = { suffix: string; raw: string; at: string[] };

type Leaf = { path: string[]; raw: string; at: string[]; extras: Extra[] };

const TUPLE_EXTRAS: { key: string; suffix: string }[] = [
  { key: 'letterSpacing', suffix: LETTER_SPACING },
  { key: 'fontWeight', suffix: FONT_WEIGHT }
];

function tupleLeaf(value: [string, ...unknown[]], path: string[]): Leaf {
  const options = value[1];
  const own = isObject(options) ? options : null;
  const lineHeight = typeof options === 'string' ? options : typeof own?.lineHeight === 'string' ? own.lineHeight : undefined;
  const lineAt = typeof options === 'string' ? [...path, '1'] : [...path, '1', 'lineHeight'];
  const extras: Extra[] = [
    ...(lineHeight ? [{ suffix: LINE_HEIGHT, raw: lineHeightOf(value[0], lineHeight), at: lineAt }] : []),
    ...TUPLE_EXTRAS.flatMap(({ key, suffix }) => (typeof own?.[key] === 'string' ? [{ suffix, raw: own[key] as string, at: [...path, '1', key] }] : []))
  ];
  return { path, raw: value[0], at: [...path, '0'], extras };
}

function leaves(value: unknown, path: string[]): Leaf[] {
  if (typeof value === 'string') {
    return [{ path, raw: value, at: path, extras: [] }];
  }
  if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
    return [{ path, raw: value.join(', '), at: path, extras: [] }];
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return [tupleLeaf(value as [string, ...unknown[]], path)];
  }
  return isObject(value) ? Object.entries(value).flatMap(([k, v]) => leaves(v, [...path, k])) : [];
}

const nameOf = (scale: Scale, path: string[]) => (joined(path) ? `${scale.prefix}-${joined(path)}` : scale.prefix);

export const themeName = (path: string[]): string | null => {
  const scale = SCALES.find((s) => s.key === path[0]);
  return scale ? nameOf(scale, path.slice(1)) : null;
};

export const SCALE_KEYS: string[] = SCALES.map((s) => s.key);

export function configTokens(config: unknown, file: string, place: Place = () => ({ file, line: 1, column: 0 })): Declared[] {
  const theme = themeOf(config);
  if (!theme) {
    return [];
  }
  return SCALES.flatMap((scale) =>
    leaves(theme[scale.key], []).flatMap((leaf) => {
      const name = nameOf(scale, leaf.path);
      const own: Declared = { name, raw: aliased(leaf.raw), mode: LIGHT, at: place([scale.key, ...leaf.at]) };
      return [own, ...leaf.extras.map((e): Declared => ({ name: `${name}${e.suffix}`, raw: e.raw, mode: LIGHT, at: place([scale.key, ...e.at]) }))];
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
