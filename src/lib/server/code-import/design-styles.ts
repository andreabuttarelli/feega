import type { MotionClip } from '@feega/motion-core/motion/doc';
import { EFFECT_PREFIX, type Effect } from '@feega/motion-core/motion/effects/model';
import { EffectKind } from '@feega/motion-core/motion/effects/registry';
import { MAX_STYLES, STYLE_NAME, StyleKind, styleSchema, type Style } from '@feega/motion-core/motion/styles-model';
import { AUTO, leadingOf, trackingOf } from '@feega/motion-core/motion/type-units';
import { LIGHT, type DeclAt, type Parsed } from './css-tokens';
import { collectionName, lengthPx, type TokenEntry, type TokenMap } from './design-tokens';
import { colourOf } from './token-colour';

export enum StyleField {
  Size = 'size',
  Leading = 'leading',
  Tracking = 'tracking',
  Weight = 'weight',
  Shadow = 'shadow'
}

type StyledKind = StyleKind.Text | StyleKind.Effect;

type Part = { name: string; raw: string; at: DeclAt };

export type StyleToken = { leaf: string; kind: StyledKind; utility?: string; rule?: string; parts: Partial<Record<StyleField, Part>> };

export type Units = { side: number; scale: number };

type Value = number | Effect[];

type FieldRow = {
  kind: StyledKind;
  property: string;
  suffix: string;
  read: (raw: string, unit: number) => Value | null;
  write: (value: Value, raw: string, unit: number) => string | null;
  unit: (units: Units) => number;
  fit: number;
};

const TEXT_GROUP = 'Text';
const SHADOW_GROUP = 'Shadow';
const TEXT_SCALE = /^--text-(?!shadow-)([\w.-]+?)(--(line-height|letter-spacing|font-weight))?$/;
const SHADOW_SCALE = /^--shadow-([\w.-]+)$/;
const RATIO = /^calc\(\s*(-?\d*\.?\d+)\s*\/\s*(-?\d*\.?\d+)\s*\)$/;
const PLAIN_NUMBER = /^-?\d*\.?\d+$/;
const PERCENT = /^(-?\d*\.?\d+)%$/;
const EM = /^(-?\d*\.?\d+)em$/;
const LENGTH_PX = /^-?\d*\.?\d+(px)?$/;
const WEIGHT_WORDS: Record<string, number> = { normal: 400, bold: 700 };
const REM_PX = 16;
const RATIO_PLACES = 4;
const SIZE_PLACES = 8;
const PX_PLACES = 2;
const ALPHA_PLACES = 2;
const BYTE = 255;
const SAME_PX = 0.5;
const SAME = 1e-6;
const SAME_RATIO = 0.02;
const SAME_EM = 0.002;
const SAME_ALPHA = 0.02;
const MAX_LEAF = 24;

const fixed = (n: number, places: number) => Number(n.toFixed(places));

function ratioOf(raw: string): number | null {
  const calc = RATIO.exec(raw);
  if (calc) {
    return fixed(Number(calc[1]) / Number(calc[2]), RATIO_PLACES);
  }
  const percent = PERCENT.exec(raw);
  return percent ? Number(percent[1]) / 100 : PLAIN_NUMBER.test(raw) ? Number(raw) : null;
}

function ratioText(value: number, raw: string): string {
  const calc = RATIO.exec(raw);
  if (calc) {
    return `calc(${fixed(value * Number(calc[2]), RATIO_PLACES)} / ${calc[2]})`;
  }
  return PERCENT.test(raw) ? `${fixed(value * 100, RATIO_PLACES)}%` : String(fixed(value, RATIO_PLACES));
}

const emOf = (raw: string) => (raw === '0' ? 0 : EM.test(raw) ? Number(EM.exec(raw)![1]) : null);

const weightOf = (raw: string) => (PLAIN_NUMBER.test(raw) ? Number(raw) : (WEIGHT_WORDS[raw] ?? null));

function splitTop(value: string, separator: RegExp): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    depth += value[i] === '(' ? 1 : value[i] === ')' ? -1 : 0;
    if (depth === 0 && separator.test(value[i])) {
      parts.push(value.slice(start, i));
      start = i + 1;
    }
  }
  return [...parts, value.slice(start)].map((p) => p.trim()).filter(Boolean);
}

function shadowOf(raw: string, unit: number): Effect[] | null {
  const effects = splitTop(raw, /,/).map((layer, i): Effect | null => {
    const words = splitTop(layer, /\s/);
    const lengths = words.filter((w) => LENGTH_PX.test(w)).map((w) => Number.parseFloat(w));
    const hex = colourOf(words.filter((w) => !LENGTH_PX.test(w)).join(' '));
    if (words.includes('inset') || lengths.length < 2 || !hex) {
      return null;
    }
    const [x, y, blur = 0, spread = 0] = lengths.map((n) => fixed(n * unit, PX_PLACES));
    const opacity = hex.length > 7 ? fixed(parseInt(hex.slice(7, 9), 16) / BYTE, ALPHA_PLACES) : 1;
    return { id: `${EFFECT_PREFIX}${i + 1}`, kind: EffectKind.DropShadow, enabled: true, params: { distance: 0, x, y, blur, spread, color: hex.slice(0, 7), opacity } };
  });
  return effects.length && effects.every(Boolean) ? (effects as Effect[]) : null;
}

function colourText(like: string, hex: string, opacity: number): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  if (/^rgba?\(/i.test(like)) {
    return like.includes(',') ? `rgba(${r}, ${g}, ${b}, ${opacity})` : `rgb(${r} ${g} ${b} / ${opacity})`;
  }
  return opacity < 1 ? `${hex}${Math.round(opacity * BYTE).toString(16).padStart(2, '0')}` : hex;
}

function shadowText(value: Value, raw: string, unit: number): string | null {
  if (!Array.isArray(value) || value.some((e) => e.kind !== EffectKind.DropShadow)) {
    return null;
  }
  const like = splitTop(splitTop(raw, /,/)[0] ?? '', /\s/).filter((w) => !LENGTH_PX.test(w)).join(' ');
  const px = (n: unknown) => `${fixed(Number(n ?? 0) / unit, PX_PLACES)}px`;
  return value.map((e) => `${px(e.params.x)} ${px(e.params.y)} ${px(e.params.blur)} ${px(e.params.spread)} ${colourText(like, String(e.params.color), Number(e.params.opacity ?? 1))}`).join(', ');
}

function sameShadow(a: Value, b: Value, tolerance: number): boolean {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return false;
  }
  const close = (x: unknown, y: unknown, tolerance: number) => Math.abs(Number(x ?? 0) - Number(y ?? 0)) <= tolerance;
  return a.every((e, i) => {
    const [p, q] = [e.params, b[i].params];
    const lengths = ['x', 'y', 'blur', 'spread'].every((k) => close(p[k], q[k], tolerance));
    return e.kind === b[i].kind && lengths && String(p.color).toLowerCase() === String(q.color).toLowerCase() && close(p.opacity, q.opacity, Math.min(tolerance, SAME_ALPHA));
  });
}

const lengthText = (value: Value, raw: string, unit: number) => {
  const px = Number(value) / unit;
  return /rem\s*$/.test(raw) ? `${fixed(px / REM_PX, RATIO_PLACES)}rem` : `${fixed(px, PX_PLACES)}px`;
};

export const FIELDS: Record<StyleField, FieldRow> = {
  [StyleField.Size]: { kind: StyleKind.Text, property: 'font-size', suffix: '', read: (raw, unit) => (lengthPx(raw) === null ? null : fixed(lengthPx(raw)! * unit, SIZE_PLACES)), write: lengthText, unit: (u) => u.scale / u.side, fit: SAME_PX },
  [StyleField.Leading]: { kind: StyleKind.Text, property: 'line-height', suffix: '--line-height', read: ratioOf, write: (v, raw) => ratioText(Number(v), raw), unit: () => 1, fit: SAME_RATIO },
  [StyleField.Tracking]: { kind: StyleKind.Text, property: 'letter-spacing', suffix: '--letter-spacing', read: emOf, write: (v) => `${fixed(Number(v), RATIO_PLACES)}em`, unit: () => 1, fit: SAME_EM },
  [StyleField.Weight]: { kind: StyleKind.Text, property: 'font-weight', suffix: '--font-weight', read: weightOf, write: (v) => String(Math.round(Number(v))), unit: () => 1, fit: 0 },
  [StyleField.Shadow]: { kind: StyleKind.Effect, property: 'box-shadow', suffix: '', read: shadowOf, write: shadowText, unit: (u) => u.scale, fit: SAME_PX }
};

function same(field: StyleField, a: Value, b: Value, tolerance: number): boolean {
  return field === StyleField.Shadow ? sameShadow(a, b, tolerance) : typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= tolerance;
}

const fieldsOf = (kind: StyledKind) => (Object.keys(FIELDS) as StyleField[]).filter((f) => FIELDS[f].kind === kind);

const bySuffix = (suffix: string) => (Object.keys(FIELDS) as StyleField[]).find((f) => FIELDS[f].kind === StyleKind.Text && FIELDS[f].suffix === suffix)!;

const byProperty = (property: string) => (Object.keys(FIELDS) as StyleField[]).find((f) => FIELDS[f].property === property)!;

const leafOf = (selector: string) => selector.split(',')[0].replace(/[^A-Za-z0-9_-]+/g, ' ').trim().slice(0, MAX_LEAF).trim();

export function styleTokensOf(parsed: Parsed): StyleToken[] {
  const byLeaf = new Map<string, StyleToken>();
  const ensure = (key: string, token: Omit<StyleToken, 'parts'>) => byLeaf.get(key) ?? byLeaf.set(key, { ...token, parts: {} }).get(key)!;

  for (const d of parsed.declared.filter((d) => d.mode === LIGHT)) {
    const text = TEXT_SCALE.exec(d.name);
    const shadow = SHADOW_SCALE.exec(d.name);
    if (text) {
      ensure(`text ${text[1]}`, { leaf: text[1], kind: StyleKind.Text, utility: `text-${text[1]}` }).parts[bySuffix(text[2] ?? '')] = { name: d.name, raw: d.raw, at: d.at };
    } else if (shadow) {
      ensure(`shadow ${shadow[1]}`, { leaf: shadow[1], kind: StyleKind.Effect, utility: `shadow-${shadow[1]}` }).parts[StyleField.Shadow] = { name: d.name, raw: d.raw, at: d.at };
    }
  }

  for (const [selector, decls] of Map.groupBy(parsed.typed, (t) => t.selector)) {
    const field = (property: string) => decls.findLast((d) => d.property === property);
    const sized = Boolean(field('font-size'));
    const shadowed = Boolean(field('box-shadow'));
    for (const kind of [...(sized ? [StyleKind.Text] : []), ...(shadowed ? [StyleKind.Effect] : [])] as StyledKind[]) {
      const token = ensure(`${kind} rule ${selector}`, { leaf: leafOf(selector), kind, rule: selector });
      for (const f of fieldsOf(kind)) {
        const d = field(FIELDS[f].property);
        if (d) {
          token.parts[byProperty(d.property)] = { name: d.property, raw: d.raw, at: d.at };
        }
      }
    }
  }

  return [...byLeaf.values()].filter((t) => t.kind === StyleKind.Effect || t.parts[StyleField.Size]);
}

export type MadeStyles = { styles: Record<string, Style>; map: TokenMap; dropped: string[]; utilities: Map<string, string>; rules: { selector: string; style: string }[] };

const atText = (at: DeclAt) => `${at.file}:${at.line}:${at.column}`;

export const styleNameOf = (repo: string, kind: StyledKind, leaf: string) => `${collectionName(repo, kind === StyleKind.Text ? TEXT_GROUP : SHADOW_GROUP)}/${leaf}`;

function styleOf(token: StyleToken, units: Units): Style | string {
  const values: Record<string, Value> = {};
  for (const [field, part] of Object.entries(token.parts) as [StyleField, Part][]) {
    const value = FIELDS[field].read(part.raw.trim(), FIELDS[field].unit(units));
    if (value === null) {
      return `${part.name}: ${part.raw} is not a value a ${token.kind} style holds`;
    }
    values[field] = value;
  }
  const style = token.kind === StyleKind.Effect ? { kind: StyleKind.Effect, effects: values[StyleField.Shadow] } : { kind: StyleKind.Text, ...values };
  const parsed = styleSchema.safeParse(style);
  return parsed.success ? parsed.data : `${token.leaf}: ${parsed.error.issues[0].message}`;
}

export function madeStyles(tokens: StyleToken[], repo: string, units: Units): MadeStyles {
  const made: MadeStyles = { styles: {}, map: {}, dropped: [], utilities: new Map(), rules: [] };
  for (const token of tokens) {
    const name = styleNameOf(repo, token.kind, token.leaf);
    const style = styleOf(token, units);
    if (typeof style === 'string' || !STYLE_NAME.test(name) || made.styles[name] || Object.keys(made.styles).length >= MAX_STYLES) {
      made.dropped.push(typeof style === 'string' ? style : `${name}: its name is taken, not allowed, or over the ${MAX_STYLES}-style limit`);
      continue;
    }
    made.styles[name] = style;
    for (const [field, part] of Object.entries(token.parts) as [StyleField, Part][]) {
      const entry: TokenEntry = { name: part.name, origins: { [LIGHT]: atText(part.at) }, raw: { [LIGHT]: part.raw }, scale: FIELDS[field].unit(units), style: name, field, ...(token.rule ? { rule: token.rule } : {}) };
      made.map[`${name}#${field}`] = entry;
    }
    if (token.utility) {
      made.utilities.set(token.utility, name);
    }
    if (token.rule) {
      made.rules.push({ selector: token.rule, style: name });
    }
  }
  return made;
}

export function styleValue(style: Style | undefined, field: StyleField): Value | undefined {
  if (!style) {
    return undefined;
  }
  return field === StyleField.Shadow ? (style.kind === StyleKind.Effect ? style.effects : undefined) : (style as Record<string, unknown>)[field] as number | undefined;
}

export function importedValue(entry: TokenEntry, raw: string): Value | null {
  const row = FIELDS[entry.field as StyleField];
  return row ? row.read(raw.trim(), entry.scale ?? 1) : null;
}

export function sameStyleValue(entry: TokenEntry, a: Value | null | undefined, b: Value | undefined): boolean {
  const row = FIELDS[entry.field as StyleField];
  return Boolean(row) && a !== null && a !== undefined && b !== undefined && same(entry.field as StyleField, a, b, SAME);
}

export function styleText(entry: TokenEntry, value: Value, raw: string): string | null {
  const row = FIELDS[entry.field as StyleField];
  return row ? row.write(value, raw.trim(), entry.scale ?? 1) : null;
}

const effectsOf = (clip: MotionClip): Effect[] => clip.effects.map(({ lut: _lut, ...e }) => e);

const ON_CLIP: Record<StyleField, (clip: MotionClip, side: number, rootUnit: number) => Value | undefined> = {
  [StyleField.Size]: (clip, _w, rootUnit) => (typeof clip.props.size === 'number' ? clip.props.size / rootUnit : undefined),
  [StyleField.Leading]: (clip, w) => {
    const leading = leadingOf(clip.props, Number(clip.props.size) * w);
    return leading === AUTO ? undefined : leading;
  },
  [StyleField.Tracking]: (clip, w) => trackingOf(clip.props, Number(clip.props.size) * w),
  [StyleField.Weight]: (clip) => Number(clip.props.weight ?? 400),
  [StyleField.Shadow]: (clip) => (clip.effects.length ? effectsOf(clip) : undefined)
};

export function styleFits(style: Style, clip: MotionClip, side: number, rootUnit: number): boolean {
  const fields = style.kind === StyleKind.Effect ? [StyleField.Shadow] : style.kind === StyleKind.Text ? fieldsOf(StyleKind.Text).filter((f) => styleValue(style, f) !== undefined) : [];
  return (
    fields.length > 0 &&
    fields.every((f) => {
      const [want, got] = [styleValue(style, f)!, ON_CLIP[f](clip, side, rootUnit)];
      if (got === undefined) {
        return false;
      }
      return same(f, want, got, f === StyleField.Size ? FIELDS[f].fit / side : FIELDS[f].fit);
    })
  );
}
