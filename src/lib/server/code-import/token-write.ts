import { isAbsolute, normalize } from 'node:path';
import { VarType, splitKey, type VarAlias, type VarLiteral, type Variable, type Variables } from '@feega/motion-core/motion/variables-model';
import { aliasOf, lengthPx, type TokenEntry, type TokenMap } from './design-tokens';
import { colourOf, writtenLike } from './token-colour';
import { atOf, type FileChange, type ReadFile } from './write-back';

export type TokensWritten = { files: FileChange[]; skipped: string[]; map: TokenMap };

const REM_PX = 16;
const PLACES = 4;
const SAME = 1e-6;
const REM = /rem\s*$/;

type Value = VarLiteral | VarAlias;

const isAlias = (v: unknown): v is VarAlias => typeof v === 'object' && v !== null;
const trimmed = (n: number) => String(Number(n.toFixed(PLACES)));
const shown = (v: Value) => (isAlias(v) ? v.alias : String(v));

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
      return px === null ? null : px * (r.entry.scale ?? 1);
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
      const px = Number(now) / (r.entry.scale ?? 1);
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

const outside = (raw: string) => isAbsolute(raw) || normalize(raw).startsWith('..');

const variableAt = (variables: Variables | undefined, key: string): { variable: Variable; modes: string[] } | null => {
  const at = splitKey(key);
  const collection = at ? variables?.[at[0]] : undefined;
  const variable = at ? collection?.vars[at[1]] : undefined;
  return collection && variable ? { variable, modes: collection.modes } : null;
};

export async function writeTokens(variables: Variables | undefined, map: TokenMap, read: ReadFile): Promise<TokensWritten> {
  const byName = new Map(Object.entries(map).map(([key, entry]) => [entry.name, key]));
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

  for (const [key, entry] of Object.entries(map)) {
    const found = variableAt(variables, key);
    if (!found) {
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
      const origin = entry.origins[mode];
      if (!origin) {
        skipped.push(`${entry.name}: no ${mode} declaration in the code, ${shown(now)} not written`);
        continue;
      }
      const at = atOf(origin);
      if (!at || outside(origin)) {
        skipped.push(`${entry.name}: ${origin} is outside the repository`);
        continue;
      }
      const text = textOf(reading, raw, now, map);
      const file = await current(at.file);
      const changed = text === null || file === null ? null : replaced(file, at.line, entry.name, raw, text);
      if (text === null) {
        skipped.push(`${entry.name} (${mode}): ${shown(now)} cannot be written as CSS`);
        continue;
      }
      if (changed === null) {
        skipped.push(`${entry.name} (${mode}) changed in the code since the import: the code wins, the canvas value was ${shown(now)}`);
        continue;
      }
      after.set(at.file, changed);
      next[key].raw[mode] = text;
    }
  }

  const files = [...after].map(([path, text]) => ({ path, before: before.get(path) ?? '', after: text })).filter((f) => f.before !== f.after);
  return { files, skipped, map: next };
}
