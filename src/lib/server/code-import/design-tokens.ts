import { MAX_MODES, MAX_VARIABLES, VARIABLE_NAME, VarType, keyOf, type Collection, type VarAlias, type VarLiteral, type Variables } from '@feega/motion-core/motion/variables-model';
import { ACCENT, accentOf, DARK, LIGHT, fromPage, type DeclAt, type Parsed } from './css-tokens';
import { colourOf } from './token-colour';

export enum TokenKind {
  Colour = 'colour',
  Radius = 'radius',
  Spacing = 'spacing',
  Font = 'font',
  Breakpoint = 'breakpoint',
  Easing = 'easing'
}

export type TokenValue = { raw: string; at: DeclAt };

export type Token = { name: string; kind: TokenKind; values: Record<string, TokenValue>; accent?: boolean };

export type TokenSet = { tokens: Token[]; modes: string[]; skipped: string[] };

export type TokenEntry = { name: string; origins: Record<string, string>; raw: Record<string, string>; scale?: number; orphan?: boolean; factor?: number; style?: string; field?: string; rule?: string };

export const SPACING_BASE = '--spacing';

export const tokenId = (entry: TokenEntry) => (entry.rule ? `${entry.rule} { ${entry.name} }` : entry.factor ? `${entry.name}-${entry.factor}` : entry.name);

export type TokenMap = Record<string, TokenEntry>;

export const readOnlyKeys = (map: TokenMap) => new Set(Object.entries(map).flatMap(([key, entry]) => (Object.values(entry.origins).every(fromPage) ? [key] : [])));

type Row = { test: RegExp; strip: string; kind: TokenKind | null; group: string; reason?: string };

export const OTHER_GROUP = 'Other';

const AS_STYLE = 'a style';

const PALETTE = 'Palette';
const DEFAULT_STRIP = '--';
const REM_PX = 16;
const MAX_NAME = 40;

const TOKEN_ROWS: Row[] = [
  { test: /^--color-/, strip: '--color-', kind: TokenKind.Colour, group: 'Colors' },
  { test: /^--radius-/, strip: '--radius-', kind: TokenKind.Radius, group: 'Radius' },
  { test: /^--spacing-/, strip: '--spacing-', kind: TokenKind.Spacing, group: 'Spacing' },
  { test: /^--font-(weight|feature|variation)/, strip: DEFAULT_STRIP, kind: null, group: '', reason: 'font weights and features are not variables yet' },
  { test: /^--font-/, strip: '--font-', kind: TokenKind.Font, group: 'Type' },
  { test: /^--(inset-shadow|drop-shadow|text-shadow)-/, strip: DEFAULT_STRIP, kind: null, group: '', reason: 'only box shadows become effect styles' },
  { test: /^--(text|shadow)-/, strip: DEFAULT_STRIP, kind: null, group: '', reason: AS_STYLE },
  { test: /^--(leading|tracking)-/, strip: DEFAULT_STRIP, kind: null, group: '', reason: 'a line-height or letter-spacing scale is not a variable; text styles carry it' },
  { test: /^--breakpoint-/, strip: '--breakpoint-', kind: TokenKind.Breakpoint, group: OTHER_GROUP },
  { test: /^--ease-/, strip: '--ease-', kind: TokenKind.Easing, group: OTHER_GROUP },
  { test: /^--(container|animate|blur|perspective|aspect)-/, strip: DEFAULT_STRIP, kind: null, group: '', reason: 'not bindable to a layer in feega yet' },
  { test: /radius/, strip: DEFAULT_STRIP, kind: TokenKind.Radius, group: 'Radius' },
  { test: /gap|spacing|space/, strip: DEFAULT_STRIP, kind: TokenKind.Spacing, group: 'Spacing' },
  { test: /^--/, strip: DEFAULT_STRIP, kind: TokenKind.Colour, group: PALETTE }
];

const VAR_TYPE: Record<TokenKind, VarType> = {
  [TokenKind.Colour]: VarType.Colour,
  [TokenKind.Radius]: VarType.Number,
  [TokenKind.Spacing]: VarType.Number,
  [TokenKind.Font]: VarType.String,
  [TokenKind.Breakpoint]: VarType.Number,
  [TokenKind.Easing]: VarType.String
};

const ALIAS = /^var\(\s*(--[\w.-]+)\s*\)$/;
const LENGTH = /^(-?\d*\.?\d+)(px|rem)?$/;

const rowOf = (name: string): Row => TOKEN_ROWS.find((r) => r.test.test(name))!;

export function variableName(source: string): string {
  const row = rowOf(source);
  const bare = source.startsWith(row.strip) && source.length > row.strip.length ? source.slice(row.strip.length) : source.slice(DEFAULT_STRIP.length);
  return bare.replace(/\./g, '_').replace(/[^A-Za-z0-9 _-]/g, '-').slice(0, MAX_NAME);
}

export function collectionName(repo: string, group: string): string {
  const base = repo.split('.')[0] || repo;
  const clean = base.replace(/[^A-Za-z0-9 _-]/g, '-').replace(/^[^A-Za-z0-9]+/, '');
  return `${clean.slice(0, MAX_NAME - group.length - 1)} ${group}`.trim();
}

export const groupOf = (name: string) => rowOf(name).group;

const tokenGroup = (token: Token) => (token.accent ? ACCENT : groupOf(token.name));

export const aliasOf = (raw: string) => ALIAS.exec(raw.trim())?.[1] ?? null;

export function lengthPx(raw: string): number | null {
  const m = LENGTH.exec(raw.trim());
  if (!m || (m[2] === undefined && Number(m[1]) !== 0)) {
    return null;
  }
  return m[2] === 'rem' ? Number(m[1]) * REM_PX : Number(m[1]);
}

type Literal = (raw: string) => VarLiteral | null;

const LITERAL: Record<TokenKind, Literal> = {
  [TokenKind.Colour]: colourOf,
  [TokenKind.Radius]: lengthPx,
  [TokenKind.Spacing]: lengthPx,
  [TokenKind.Font]: (raw) => raw,
  [TokenKind.Breakpoint]: lengthPx,
  [TokenKind.Easing]: (raw) => raw
};

const NOT_A_TOKEN = 'not a colour, radius, spacing or font token';

type Refused = { reason: string };

const refused = (reason: string): Refused => ({ reason });

function kindOf(name: string, raws: string[], declared: Map<string, string[]>, seen: string[] = []): TokenKind | Refused {
  const row = rowOf(name);
  if (!row.kind) {
    return refused(row.reason!);
  }
  if (raws.some((r) => /\bcalc\(/.test(r))) {
    return refused('computed with calc(), not a literal');
  }
  const target = raws.map(aliasOf).find(Boolean);
  if (target) {
    const of = declared.has(target) && !seen.includes(target) ? kindOf(target, declared.get(target)!, declared, [...seen, name]) : null;
    if (!of || typeof of === 'object') {
      return refused(`alias to ${target}, which is not a token here`);
    }
    return row.group === PALETTE || row.kind === of ? of : refused(`alias to ${target}, a ${of}`);
  }
  const literal = row.group === PALETTE ? LITERAL[TokenKind.Colour] : LITERAL[row.kind];
  return raws.every((r) => literal(r) !== null) ? row.kind : refused(NOT_A_TOKEN);
}

const MODE_ORDER = [LIGHT, DARK];

const ordered = (modes: string[]) => [...MODE_ORDER.filter((m) => modes.includes(m)), ...modes.filter((m) => !MODE_ORDER.includes(m))];

export function tokenSetOf(parsed: Parsed): TokenSet {
  const byName = new Map<string, Record<string, TokenValue>>();
  const byAccent = new Map<string, Record<string, TokenValue>>();
  for (const d of parsed.declared) {
    const accent = accentOf(d.mode);
    const [into, mode] = accent ? [byAccent, accent] : [byName, d.mode];
    into.set(d.name, { ...into.get(d.name), [mode]: { raw: d.raw, at: d.at } });
  }
  const raws = new Map([...byName].map(([name, values]) => [name, Object.values(values).map((v) => v.raw)]));
  const skipped = [...parsed.skipped];
  const tokens: Token[] = [];

  for (const [name, values] of byName) {
    const kind = kindOf(name, raws.get(name)!, raws);
    if (typeof kind === 'object') {
      skipped.push(...(kind.reason === AS_STYLE ? [] : [`${name}: ${kind.reason}`]));
      continue;
    }
    tokens.push({ name, kind, values });
  }

  const kept = new Set(tokens.map((t) => t.name));
  const valid = tokens.filter((t) => Object.values(t.values).every((v) => !aliasOf(v.raw) || kept.has(aliasOf(v.raw)!)));
  const kinds = new Map(valid.map((t) => [t.name, t.kind]));
  const accents = [...byAccent].flatMap(([name, values]) => (kinds.has(name) ? [{ name, kind: kinds.get(name)!, values, accent: true }] : []));
  return { tokens: [...valid, ...accents], modes: ordered([...new Set(valid.flatMap((t) => Object.keys(t.values)))]), skipped };
}

export type Options = { scale?: number; used?: ReadonlySet<string>; active?: string; multiples?: readonly number[] };

export type Made = { variables: Variables; map: TokenMap; dropped: string[] };

const atText = (at: DeclAt) => `${at.file}:${at.line}:${at.column}`;

function capped(tokens: Token[], used: ReadonlySet<string>): { kept: Token[]; over: Token[] } {
  const ranked = [...tokens.filter((t) => used.has(t.name)), ...tokens.filter((t) => !used.has(t.name))];
  const kept = new Set(ranked.slice(0, MAX_VARIABLES));
  return { kept: tokens.filter((t) => kept.has(t)), over: tokens.filter((t) => !kept.has(t)) };
}

function survivors(tokens: Token[], repo: string, used: ReadonlySet<string>, dropped: string[]): Token[] {
  const groups = Map.groupBy(tokens, tokenGroup);
  const kept: Token[] = [];
  for (const [group, list] of groups) {
    const { kept: inside, over } = capped(list, used);
    kept.push(...inside);
    dropped.push(...over.map((t) => `${t.name}: over the ${MAX_VARIABLES}-variable limit of ${collectionName(repo, group)}`));
  }

  let names = new Set(kept.map((t) => t.name));
  let alive = kept;
  for (let changed = true; changed; ) {
    const next = alive.filter((t) => Object.values(t.values).every((v) => !aliasOf(v.raw) || names.has(aliasOf(v.raw)!)));
    dropped.push(...alive.filter((t) => !next.includes(t)).map((t) => `${t.name}: its alias target was left out`));
    changed = next.length !== alive.length;
    alive = next;
    names = new Set(alive.map((t) => t.name));
  }
  return alive;
}

export const keyOfToken = (repo: string, name: string) => keyOf(collectionName(repo, groupOf(name)), variableName(name));

export function variablesOf(set: TokenSet, repo: string, options: Options = {}): Made {
  const scale = options.scale ?? 1;
  const dropped: string[] = [];
  const kept = survivors(set.tokens, repo, options.used ?? new Set(), dropped);
  const variables: Variables = {};
  const map: TokenMap = {};

  for (const [group, list] of Map.groupBy(kept, tokenGroup)) {
    const name = collectionName(repo, group);
    const allModes = ordered([...new Set(list.flatMap((t) => Object.keys(t.values)))]);
    const modes = allModes.slice(0, MAX_MODES);
    dropped.push(...allModes.slice(MAX_MODES).map((m) => `${name}: mode ${m} is over the ${MAX_MODES}-mode limit`));

    const vars: Collection['vars'] = {};
    for (const token of list) {
      const first = Object.values(token.values)[0];
      const valueIn = (mode: string): VarLiteral | VarAlias => {
        const raw = (token.values[mode] ?? first).raw;
        const target = aliasOf(raw);
        if (target) {
          return { alias: keyOfToken(repo, target) };
        }
        const literal = LITERAL[token.kind](raw)!;
        return typeof literal === 'number' ? literal * scale : literal;
      };
      const varName = variableName(token.name);
      if (!VARIABLE_NAME.test(varName) || vars[varName]) {
        dropped.push(`${token.name}: its name ${varName} is taken or not allowed in ${name}`);
        continue;
      }
      vars[varName] = { type: VAR_TYPE[token.kind], values: Object.fromEntries(modes.map((m) => [m, valueIn(m)])) };
      const own = modes.filter((m) => token.values[m]);
      map[keyOf(name, varName)] = {
        name: token.name,
        origins: Object.fromEntries(own.map((m) => [m, atText(token.values[m].at)])),
        raw: Object.fromEntries(own.map((m) => [m, token.values[m].raw])),
        ...(VAR_TYPE[token.kind] === VarType.Number ? { scale } : {})
      };
    }
    const base = list.find((t) => t.name === SPACING_BASE);
    for (const factor of base ? (options.multiples ?? []) : []) {
      const varName = variableName(`${SPACING_BASE}-${factor}`);
      if (vars[varName] || Object.keys(vars).length >= MAX_VARIABLES) {
        continue;
      }
      const own = modes.filter((m) => base!.values[m]);
      const first = Object.values(base!.values)[0];
      vars[varName] = { type: VarType.Number, values: Object.fromEntries(modes.map((m) => [m, lengthPx((base!.values[m] ?? first).raw)! * scale * factor])) };
      map[keyOf(name, varName)] = { name: SPACING_BASE, origins: Object.fromEntries(own.map((m) => [m, atText(base!.values[m].at)])), raw: Object.fromEntries(own.map((m) => [m, base!.values[m].raw])), scale, factor };
    }
    const active = options.active && modes.includes(options.active) ? { active: options.active } : {};
    variables[name] = { modes, ...active, vars };
  }
  return { variables, map, dropped };
}
