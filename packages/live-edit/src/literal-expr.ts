import type { Json } from './prop-syntax';

const NUMBER = /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/i;
const IDENTIFIER = /^[A-Za-z_$][\w$]*/;
const KEYWORDS: Record<string, Json> = { true: true, false: false, null: null };
const QUOTES = new Set(['"', "'", '`']);
const ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', "'": "'", '`': '`' };

class Reader {
  at = 0;
  constructor(readonly text: string) {}

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
}

function stringOf(reader: Reader): string | null {
  reader.space();
  const quote = reader.text[reader.at];
  if (!QUOTES.has(quote)) {
    return null;
  }
  let out = '';
  for (let i = reader.at + 1; i < reader.text.length; i++) {
    const ch = reader.text[i];
    if (ch === quote) {
      reader.at = i + 1;
      return out;
    }
    if (quote === '`' && ch === '$' && reader.text[i + 1] === '{') {
      return null;
    }
    out += ch === '\\' ? (ESCAPES[reader.text[++i]] ?? reader.text[i]) : ch;
  }
  return null;
}

function sequence(reader: Reader, close: string, item: () => boolean): boolean {
  if (reader.take(close)) {
    return true;
  }
  while (item()) {
    if (!reader.take(',')) {
      return reader.take(close);
    }
    if (reader.take(close)) {
      return true;
    }
  }
  return false;
}

function valueOf(reader: Reader): { value: Json } | null {
  const text = stringOf(reader);
  if (text !== null) {
    return { value: text };
  }
  const number = reader.match(NUMBER);
  if (number !== null) {
    return { value: Number(number) };
  }
  if (reader.take('[')) {
    const items: Json[] = [];
    return sequence(reader, ']', () => {
      const item = valueOf(reader);
      item && items.push(item.value);
      return item !== null;
    })
      ? { value: items }
      : null;
  }
  if (reader.take('{')) {
    const entries: Record<string, Json> = {};
    return sequence(reader, '}', () => {
      const key = stringOf(reader) ?? reader.match(IDENTIFIER);
      const colon = key !== null && reader.take(':');
      const item = colon ? valueOf(reader) : null;
      item && key !== null && (entries[key] = item.value);
      return item !== null;
    })
      ? { value: entries }
      : null;
  }
  if (reader.take('new Date(')) {
    const iso = stringOf(reader);
    return iso !== null && reader.take(')') ? { value: { $date: iso } } : null;
  }
  const word = reader.match(IDENTIFIER);
  return word !== null && word in KEYWORDS ? { value: KEYWORDS[word] } : null;
}

export function literalOf(text: string): { value: Json } | null {
  const reader = new Reader(text);
  const found = valueOf(reader);
  return found && reader.done() ? found : null;
}
