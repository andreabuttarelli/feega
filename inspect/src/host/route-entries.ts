import { UNRESOLVED, valueOfExpression, type Lookup, type Resolved, type Value } from './expression-value';

const GENERATORS = ['entries', 'generateStaticParams', 'getStaticPaths'];
const OPENERS = '([{';
const CLOSERS = ')]}';
const QUOTES = ['"', "'", '`'];
const PARAMS_KEY = 'params';
const OBJECT_VALUES = /^Object\.(keys|values)\(([\s\S]+)\)$/;
const ARROW = '=>';
const IDENTIFIER = /[A-Za-z_$][\w$]*/g;

const generatorStart = (name: string) =>
  new RegExp(String.raw`export\s+(?:(?:async\s+)?function\*?\s+${name}\s*\([^)]*\)[^{]*\{|(?:const|let)\s+${name}\b[^=]*=\s*(?:async\s+)?\([^)]*\)\s*(?::[^=]+)?=>\s*)`);

function endOfStatement(text: string, from: number): number {
  let depth = 0;
  let quote = '';

  for (let at = from; at < text.length; at++) {
    const char = text[at];
    if (quote) {
      quote = char === quote && text[at - 1] !== '\\' ? '' : quote;
      continue;
    }
    if (QUOTES.includes(char)) {
      quote = char;
      continue;
    }
    depth += OPENERS.includes(char) ? 1 : 0;
    depth -= CLOSERS.includes(char) ? 1 : 0;
    if (depth < 0 || (depth === 0 && char === ';')) {
      return at;
    }
  }

  return text.length;
}

const RETURN = /\breturn\s+/;

function bodyOffset(text: string, start: number): number | null {
  const head = text.slice(start);
  if (text[start - 1] !== '{' && !head.startsWith('{')) {
    return 0;
  }
  const found = RETURN.exec(head);

  return found ? found.index + found[0].length : null;
}

function returned(text: string, start: number): string | null {
  const offset = bodyOffset(text, start);
  if (offset === null) {
    return null;
  }
  const from = start + offset;

  return text.slice(from, endOfStatement(text, from)).trim();
}

function mapCall(expression: string): { base: string; args: string } | null {
  let depth = 0;
  for (let at = 0; at < expression.length; at++) {
    depth += OPENERS.includes(expression[at]) ? 1 : 0;
    depth -= CLOSERS.includes(expression[at]) ? 1 : 0;
    if (depth === 0 && expression.startsWith('.map(', at)) {
      const argsFrom = at + '.map('.length;
      const argsTo = endOfStatement(expression, argsFrom);

      return { base: expression.slice(0, at), args: expression.slice(argsFrom, argsTo) };
    }
  }

  return null;
}

const baseValue = (text: string, lookup: Lookup): Resolved => {
  const wrapped = OBJECT_VALUES.exec(text.trim());
  if (!wrapped) {
    return valueOfExpression(text, lookup);
  }
  const inner = valueOfExpression(wrapped[2], lookup);
  if (inner === null || typeof inner !== 'object') {
    return UNRESOLVED;
  }

  return wrapped[1] === 'keys' ? Object.keys(inner) : (Object.values(inner) as Value[]);
};

const unwrapped = (body: string) => body.trim().replace(/^\(([\s\S]*)\)$/, '$1');

function rowsOf(expression: string, lookup: Lookup): Resolved {
  const call = mapCall(expression);
  if (!call) {
    return valueOfExpression(expression, lookup);
  }
  const items = baseValue(call.base, lookup);
  const arrow = call.args.indexOf(ARROW);
  if (!Array.isArray(items) || arrow < 0) {
    return UNRESOLVED;
  }
  const names = call.args.slice(0, arrow).split(':')[0].match(IDENTIFIER) ?? [];
  const destructured = call.args.trimStart().replace(/^\(\s*/, '').startsWith('{');
  const body = unwrapped(call.args.slice(arrow + ARROW.length));

  return items.map((item) => {
    const scope = (name: string): Resolved => {
      if (destructured && item !== null && typeof item === 'object' && names.includes(name)) {
        return (item as Record<string, Value>)[name] ?? UNRESOLVED;
      }

      return !destructured && name === names[0] ? item : lookup(name);
    };
    const row = valueOfExpression(body, scope);

    return row === UNRESOLVED ? null : row;
  });
}

const textOf = (value: Value): string | null => {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  return Array.isArray(value) && value.every((part) => typeof part === 'string' || typeof part === 'number') ? value.join('/') : null;
};

function paramsOf(row: Value): Record<string, string> | null {
  if (row === null || typeof row !== 'object' || Array.isArray(row)) {
    return null;
  }
  const source = (row[PARAMS_KEY] ?? row) as Value;
  if (source === null || typeof source !== 'object' || Array.isArray(source)) {
    return null;
  }
  const entries = Object.entries(source).map(([name, value]) => [name, textOf(value)] as const);

  return entries.every(([, value]) => value !== null) ? Object.fromEntries(entries as [string, string][]) : null;
}

export const hasGenerator = (script: string): boolean => GENERATORS.some((name) => generatorStart(name).test(script));

export function entriesOf(script: string, lookup: Lookup): Record<string, string>[] {
  for (const name of GENERATORS) {
    const start = generatorStart(name).exec(script);
    const expression = start && returned(script, start.index + start[0].length);
    const rows = expression ? rowsOf(expression, lookup) : UNRESOLVED;
    if (Array.isArray(rows)) {
      return rows.flatMap((row) => (row === null ? [] : (paramsOf(row) ?? [])));
    }
  }

  return [];
}
