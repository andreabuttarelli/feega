import { isAbsolute, normalize } from 'node:path';
import { VarType, splitKey, type VarAlias, type VarLiteral, type Variable, type Variables } from '@feega/motion-core/motion/variables-model';
import { aliasOf, lengthPx, type TokenEntry, type TokenMap } from './design-tokens';
import { colourOf, writtenLike } from './token-colour';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { applyEdits, atOf, editsOf, type FileChange, type ReadFile } from './write-back';
import { LIGHT, READ_ONLY, fromPage, parseSheets } from './css-tokens';
import { importedValue as importedStyleValue, sameStyleValue, styleText, styleValue, type StyleField } from './design-styles';
import type { Style } from '@feega/motion-core/motion/styles-model';

export type TokensWritten = { files: FileChange[]; skipped: string[]; map: TokenMap };

const REM_PX = 16;
const PLACES = 4;
const SAME = 1e-6;
const REM = /rem\s*$/;

type Value = VarLiteral | VarAlias;

const isAlias = (v: unknown): v is VarAlias => typeof v === 'object' && v !== null;
const trimmed = (n: number) => String(Number(n.toFixed(PLACES)));
const shown = (v: Value) => (isAlias(v) ? v.alias : String(v));

const aliasTargets = (map: TokenMap) => new Map(Object.entries(map).flatMap(([key, entry]) => (entry.factor ? [] : [[entry.name, key] as const])));

type Reading = { type: VarType; entry: TokenEntry; byName: Map<string, string> };

function importedValue(r: Reading, raw: string): Value | null {
  const target = aliasOf(raw);
  if (target) {
    const key = r.byName.get(target);
    return key ? { alias: key } : null;
  }
  const LITERALS: Record<VarType, () => VarLiteral | null> = {
    [VarType.Colour]: () => colourOf(raw),
    [VarType.Number]: () => {
      const px = lengthPx(raw);
      return px === null ? null : px * (r.entry.scale ?? 1) * (r.entry.factor ?? 1);
    },
    [VarType.String]: () => raw,
    [VarType.Boolean]: () => null
  };
  return LITERALS[r.type]();
}

function sameValue(a: Value | null, b: Value): boolean {
  if (a === null) {
    return false;
  }
  if (isAlias(a) || isAlias(b)) {
    return isAlias(a) && isAlias(b) && a.alias === b.alias;
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) < SAME;
  }
  return typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
}

function textOf(r: Reading, raw: string, now: Value, map: TokenMap): string | null {
  if (isAlias(now)) {
    const name = map[now.alias]?.name;
    return name ? `var(${name})` : null;
  }
  const WRITERS: Record<VarType, () => string | null> = {
    [VarType.Colour]: () => (typeof now === 'string' ? writtenLike(raw, now) : null),
    [VarType.Number]: () => {
      const px = Number(now) / (r.entry.scale ?? 1) / (r.entry.factor ?? 1);
      return REM.test(raw) ? `${trimmed(px / REM_PX)}rem` : `${trimmed(px)}px`;
    },
    [VarType.String]: () => String(now),
    [VarType.Boolean]: () => null
  };
  return WRITERS[r.type]();
}

const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function replaced(text: string, line: number, name: string, was: string, next: string): string | null {
  const lines = text.split('\n');
  const at = lines[line - 1];
  const declaration = at === undefined ? null : new RegExp(`(${escaped(name)}\\s*:\\s*)([^;}]*?)(\\s*[;}]|\\s*$)`).exec(at);
  if (!declaration || declaration[2].trim() !== was.trim()) {
    return null;
  }
  lines[line - 1] = at.slice(0, declaration.index) + declaration[1] + next + declaration[3] + at.slice(declaration.index + declaration[0].length);
  return lines.join('\n');
}

type Declaration = { file: string; mode: string; name: string; was: string; hint: number };

function located(text: string, d: Declaration): number | null {
  const lines = parseSheets([{ path: d.file, text }])
    .declared.filter((found) => found.name === d.name && found.mode === d.mode && found.raw.trim() === d.was.trim())
    .map((found) => found.at.line);
  const distance = (line: number) => Math.abs(line - d.hint);
  return lines.reduce<number | null>((best, line) => (best === null || distance(line) <= distance(best) ? line : best), null);
}

function locatedRule(text: string, d: Declaration & { rule: string }): number | null {
  const lines = parseSheets([{ path: d.file, text }])
    .typed.filter((found) => found.selector === d.rule && found.property === d.name && found.raw.trim() === d.was.trim())
    .map((found) => found.at.line);
  const distance = (line: number) => Math.abs(line - d.hint);
  return lines.reduce<number | null>((best, line) => (best === null || distance(line) <= distance(best) ? line : best), null);
}

type Appended = { text: string; line: number; column: number; inserted: boolean };

const INDENT = /^\s*/;
const DEFAULT_INDENT = '\t';

function appended(text: string, path: string, mode: string, declaration: string): Appended | null {
  const block = parseSheets([{ path, text }]).blocks.findLast((b) => b.mode === mode);
  if (!block) {
    return null;
  }
  const lines = text.split('\n');
  const at = block.close.line - 1;
  const closing = lines[at];
  const before = closing.slice(0, block.close.column);
  if (before.trim()) {
    lines[at] = `${before.trimEnd()} ${declaration}; ${closing.slice(block.close.column)}`;
    return { text: lines.join('\n'), line: block.close.line, column: before.trimEnd().length + 1, inserted: false };
  }
  const previous = lines.slice(0, at).findLast((l) => l.trim());
  const indent = previous && !previous.trim().endsWith('{') ? INDENT.exec(previous)![0] : `${before}${DEFAULT_INDENT}`;
  lines.splice(at, 0, `${indent}${declaration};`);
  return { text: lines.join('\n'), line: block.close.line, column: indent.length, inserted: true };
}

function shifted(map: TokenMap, file: string, from: number): void {
  for (const entry of Object.values(map)) {
    for (const [mode, origin] of Object.entries(entry.origins)) {
      const at = atOf(origin);
      if (at && at.file === file && at.line >= from) {
        entry.origins[mode] = `${at.file}:${at.line + 1}:${at.column}`;
      }
    }
  }
}

const outside = (raw: string) => isAbsolute(raw) || normalize(raw).startsWith('..');

const variableAt = (variables: Variables | undefined, key: string): { variable: Variable; modes: string[] } | null => {
  const at = splitKey(key);
  const collection = at ? variables?.[at[0]] : undefined;
  const variable = at ? collection?.vars[at[1]] : undefined;
  return collection && variable ? { variable, modes: collection.modes } : null;
};

export function editedModes(variables: Variables | undefined, map: TokenMap): Map<string, string[]> {
  const byName = aliasTargets(map);
  const edited = new Map<string, string[]>();
  for (const [key, entry] of Object.entries(map)) {
    const found = variableAt(variables, key);
    if (!found) {
      continue;
    }
    const reading: Reading = { type: found.variable.type, entry, byName };
    const inherited = Object.values(entry.raw)[0];
    const modes = found.modes.filter((mode) => {
      const [now, raw] = [found.variable.values[mode], entry.raw[mode] ?? inherited];
      return now !== undefined && raw !== undefined && !sameValue(importedValue(reading, raw), now);
    });
    if (modes.length) {
      edited.set(key, modes);
    }
  }
  return edited;
}

export async function writeTokens(variables: Variables | undefined, map: TokenMap, read: ReadFile, styles: Record<string, Style> = {}): Promise<TokensWritten> {
  const byName = aliasTargets(map);
  const before = new Map<string, string | null>();
  const after = new Map<string, string>();
  const skipped: string[] = [];
  const next: TokenMap = structuredClone(map);

  const current = async (file: string) => {
    if (!before.has(file)) {
      before.set(file, await read(file).catch(() => null));
    }
    return after.get(file) ?? before.get(file) ?? null;
  };

  const written = new Map<string, string>();
  const missing: { key: string; entry: TokenEntry; mode: string; text: string; file: string }[] = [];

  for (const [key, entry] of Object.entries(map)) {
    if (!entry.style || entry.orphan) {
      continue;
    }
    const raw = entry.raw[LIGHT];
    const now = styleValue(styles[entry.style], entry.field as StyleField);
    if (raw === undefined || now === undefined || sameStyleValue(entry, importedStyleValue(entry, raw), now)) {
      continue;
    }
    const origin = entry.origins[LIGHT];
    const at = atOf(origin);
    if (fromPage(origin)) {
      skipped.push(`${entry.name}: ${READ_ONLY}`);
      continue;
    }
    if (!at || outside(origin)) {
      skipped.push(`${entry.name}: ${origin} is outside the repository`);
      continue;
    }
    const text = styleText(entry, now, raw);
    const file = await current(at.file);
    const declaration = { file: at.file, mode: LIGHT, name: entry.name, was: raw, hint: at.line };
    const line = file === null ? null : entry.rule ? locatedRule(file, { ...declaration, rule: entry.rule }) : located(file, declaration);
    const changed = text === null || file === null || line === null ? null : replaced(file, line, entry.name, raw, text);
    if (text === null || changed === null) {
      skipped.push(`${entry.name} (${entry.style}): ${text === null ? 'cannot be written as CSS' : 'changed in the code since the import: the code wins'}`);
      continue;
    }
    after.set(at.file, changed);
    next[key].raw[LIGHT] = text;
  }

  for (const [key, entry] of Object.entries(map)) {
    const found = variableAt(variables, key);
    if (!found || entry.orphan) {
      continue;
    }
    const reading: Reading = { type: found.variable.type, entry, byName };
    const inherited = Object.values(entry.raw)[0];

    for (const mode of found.modes) {
      const now = found.variable.values[mode];
      const raw = entry.raw[mode] ?? inherited;
      if (now === undefined || raw === undefined || sameValue(importedValue(reading, raw), now)) {
        continue;
      }
      const origin = entry.origins[mode] ?? Object.values(entry.origins)[0];
      if (fromPage(origin)) {
        skipped.push(`${entry.name}: ${READ_ONLY}`);
        break;
      }
      const own = Boolean(entry.origins[mode]);
      const at = atOf(origin);
      if (!at || outside(origin)) {
        skipped.push(`${entry.name}: ${origin} is outside the repository`);
        continue;
      }
      const text = textOf(reading, raw, now, map);
      if (!own && text !== null) {
        missing.push({ key, entry, mode, text, file: at.file });
        continue;
      }
      const file = await current(at.file);
      const spot = `${origin}|${entry.name}`;
      const already = written.get(spot);
      if (already !== undefined && text !== null) {
        if (already !== text) {
          skipped.push(`${entry.name} (${mode}): ${key} asks for ${text}, but another multiple of it already wrote ${already}`);
        }
        next[key].raw[mode] = already;
        continue;
      }
      const line = file === null ? null : located(file, { file: at.file, mode, name: entry.name, was: raw, hint: at.line });
      const changed = text === null || file === null || line === null ? null : replaced(file, line, entry.name, raw, text);
      if (text === null) {
        skipped.push(`${entry.name} (${mode}): ${shown(now)} cannot be written as CSS`);
        continue;
      }
      if (changed === null) {
        skipped.push(`${entry.name} (${mode}) changed in the code since the import: the code wins, the canvas value was ${shown(now)}`);
        continue;
      }
      after.set(at.file, changed);
      written.set(spot, text);
      next[key].origins[mode] = `${at.file}:${line}:${at.column}`;
      next[key].raw[mode] = text;
    }
  }

  for (const add of missing) {
    const file = await current(add.file);
    const done = file === null ? null : appended(file, add.file, add.mode, `${add.entry.name}: ${add.text}`);
    if (!done) {
      skipped.push(`${add.entry.name}: no ${add.mode} block in ${add.file}, ${add.text} not written`);
      continue;
    }
    after.set(add.file, done.text);
    if (done.inserted) {
      shifted(next, add.file, done.line);
    }
    next[add.key].origins[add.mode] = `${add.file}:${done.line}:${done.column}`;
    next[add.key].raw[add.mode] = add.text;
  }

  const files = [...after].map(([path, text]) => ({ path, before: before.get(path) ?? '', after: text })).filter((f) => f.before !== f.after);
  return { files, skipped, map: next };
}

export async function frameEdits(doc: MotionDoc, tokens: TokenMap | undefined, read: ReadFile): Promise<TokensWritten> {
  const layers = await applyEdits(editsOf(doc), read);
  if (!tokens) {
    return { ...layers, map: {} };
  }
  const layered = new Map(layers.files.map((f) => [f.path, f]));
  const written = await writeTokens(doc.variables, tokens, async (path) => layered.get(path)?.after ?? read(path), doc.styles ?? {});
  const touched = new Set(written.files.map((f) => f.path));
  const files = [...layers.files.filter((f) => !touched.has(f.path)), ...written.files.map((f) => ({ ...f, before: layered.get(f.path)?.before ?? f.before }))];
  return { files, skipped: [...layers.skipped, ...written.skipped], map: written.map };
}
