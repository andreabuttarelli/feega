export const UNRESOLVED = Symbol('unresolved');

export type Value = string | number | boolean | null | Value[] | { [key: string]: Value };

export type Resolved = Value | typeof UNRESOLVED;

export type Lookup = (name: string) => Resolved;

const NUMBER = /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/i;
const IDENTIFIER = /^[A-Za-z_$][\w$]*/;
const KEYWORDS: Record<string, Value> = { true: true, false: false, null: null };
const ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r' };
const ASSERTION = /^(?:as|satisfies)\b/;
const OPENERS: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
const QUOTES = ['"', "'", '`'];
const END = ',)]}';

const isValue = (resolved: Resolved): resolved is Value => resolved !== UNRESOLVED;

class Reader {
  at = 0;

  constructor(
    readonly text: string,
    readonly lookup: Lookup
  ) {}

  space() {
    while (/\s/.test(this.text[this.at] ?? '')) {
      this.at++;
    }
  }

  take(token: string): boolean {
    this.space();
    if (!this.text.startsWith(token, this.at)) {
      return false;
    }
    this.at += token.length;
    return true;
  }

  peek(): string {
    this.space();

    return this.text[this.at] ?? '';
  }

  match(pattern: RegExp): string | null {
    this.space();
    const found = pattern.exec(this.text.slice(this.at))?.[0] ?? null;
    this.at += found?.length ?? 0;

    return found;
  }

  done(): boolean {
    this.space();

    return this.at >= this.text.length;
  }

  skip(): void {
    let depth = 0;
    let quote = '';
    for (; this.at < this.text.length; this.at++) {
      const char = this.text[this.at];
      if (quote) {
        quote = char === quote && this.text[this.at - 1] !== '\\' ? '' : quote;
        continue;
      }
      if (QUOTES.includes(char)) {
        quote = char;
        continue;
      }
      if (char in OPENERS) {
        depth++;
        continue;
      }
      if (depth === 0 && END.includes(char)) {
        return;
      }
      depth -= Object.values(OPENERS).includes(char) ? 1 : 0;
    }
  }
}

function quoted(reader: Reader, quote: string): Resolved {
  let out = '';
  for (reader.at++; reader.at < reader.text.length; reader.at++) {
    const char = reader.text[reader.at];
    if (char === quote) {
      reader.at++;

      return out;
    }
    if (quote === '`' && char === '$' && reader.text[reader.at + 1] === '{') {
      return UNRESOLVED;
    }
    if (char === '\\') {
      reader.at++;
      out += ESCAPES[reader.text[reader.at]] ?? reader.text[reader.at];
      continue;
    }
    out += char;
  }

  return UNRESOLVED;
}

function array(reader: Reader): Resolved {
  const items: Value[] = [];
  reader.take('[');
  while (!reader.take(']')) {
    const start = reader.at;
    const item = expression(reader);
    if (isValue(item)) {
      items.push(item);
    } else {
      reader.at = Math.max(reader.at, start);
      reader.skip();
    }
    if (!reader.take(',') && reader.peek() !== ']') {
      return UNRESOLVED;
    }
  }

  return items;
}

function key(reader: Reader): string | null {
  const ch = reader.peek();
  if (ch === '"' || ch === "'") {
    const out = quoted(reader, ch);

    return typeof out === 'string' ? out : null;
  }

  return reader.match(IDENTIFIER) ?? reader.match(NUMBER);
}

function object(reader: Reader): Resolved {
  const out: { [key: string]: Value } = {};
  reader.take('{');
  while (!reader.take('}')) {
    const name = key(reader);
    if (name === null) {
      return UNRESOLVED;
    }
    const shorthand = reader.peek() === ',' || reader.peek() === '}';
    const value = shorthand ? reader.lookup(name) : reader.take(':') ? expression(reader) : UNRESOLVED;
    if (isValue(value)) {
      out[name] = value;
    } else if (!shorthand) {
      reader.skip();
    }
    if (!reader.take(',') && reader.peek() !== '}') {
      return UNRESOLVED;
    }
  }

  return out;
}

function primary(reader: Reader): Resolved {
  const ch = reader.peek();
  if (QUOTES.includes(ch)) {
    return quoted(reader, ch);
  }
  if (ch === '[') {
    return array(reader);
  }
  if (ch === '{') {
    return object(reader);
  }
  if (ch === '(') {
    reader.take('(');
    const inner = expression(reader);

    return reader.take(')') ? inner : UNRESOLVED;
  }
  const number = reader.match(NUMBER);
  if (number !== null) {
    return Number(number);
  }
  const word = reader.match(IDENTIFIER);
  if (word === null) {
    return UNRESOLVED;
  }

  return word in KEYWORDS ? KEYWORDS[word] : reader.lookup(word);
}

const member = (base: Resolved, name: string | number): Resolved => {
  if (base === null || typeof base !== 'object') {
    return UNRESOLVED;
  }
  const found = (base as Record<string, Value | undefined>)[String(name)];

  return found === undefined ? UNRESOLVED : found;
};

function expression(reader: Reader): Resolved {
  let value = primary(reader);
  for (;;) {
    if (reader.take('?.') || reader.take('.')) {
      const name = reader.match(IDENTIFIER);
      if (name === null) {
        return UNRESOLVED;
      }
      value = member(value, name);
      continue;
    }
    if (reader.take('[')) {
      const index = expression(reader);
      if (!reader.take(']') || index === UNRESOLVED || typeof index === 'object' || typeof index === 'boolean' || index === null) {
        return UNRESOLVED;
      }
      value = member(value, index);
      continue;
    }

    return value;
  }
}

function assertionTail(reader: Reader): boolean {
  reader.space();
  if (!ASSERTION.test(reader.text.slice(reader.at))) {
    return false;
  }
  reader.skip();

  return true;
}

export function valueAt(source: string, from: number, lookup: Lookup): Resolved {
  const reader = new Reader(source, lookup);
  reader.at = from;

  return expression(reader);
}

export function valueOfExpression(source: string, lookup: Lookup): Resolved {
  const reader = new Reader(source, lookup);
  const value = expression(reader);
  assertionTail(reader);

  return reader.done() ? value : UNRESOLVED;
}
