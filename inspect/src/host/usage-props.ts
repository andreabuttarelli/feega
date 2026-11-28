export type LiteralProps = Record<string, unknown>;

const QUOTES = ['"', "'", '`'];
const NUMBER = /^-?\d+(\.\d+)?$/;
const NOT_A_PROP = /^(@|#|v-|bind:|on:|use:|class:|style:|\.\.\.)/;
const WHITESPACE = /\s/;
const NAME_END = /[\s=/>{]/;
const VUE_BINDING = ':';

const LITERAL_WORDS: Record<string, unknown> = { true: true, false: false, null: null };

function unquoted(text: string): string | undefined {
  const quote = text[0];
  const closed = QUOTES.includes(quote) && text.length >= 2 && text.endsWith(quote);
  const inner = text.slice(1, -1);

  return closed && !inner.includes(quote) && !inner.includes('${') ? inner : undefined;
}

function literalOf(expression: string): unknown {
  const text = expression.trim();
  if (text in LITERAL_WORDS) {
    return LITERAL_WORDS[text];
  }
  if (NUMBER.test(text)) {
    return Number(text);
  }
  if (text.startsWith('[') || text.startsWith('{')) {
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  }

  return unquoted(text);
}

function closing(text: string, from: number, open: string, close: string): number {
  let depth = 0;
  let quote: string | null = null;
  for (let at = from; at < text.length; at++) {
    const char = text[at];
    if (quote) {
      quote = char === quote ? null : quote;
      continue;
    }
    if (QUOTES.includes(char)) {
      quote = char;
      continue;
    }
    depth += char === open ? 1 : char === close ? -1 : 0;
    if (depth === 0) {
      return at;
    }
  }

  return text.length;
}

type Attribute = { name: string; value: string | null; quoted: boolean; end: number };

function attributeAt(text: string, from: number): Attribute {
  let at = from;
  while (at < text.length && !NAME_END.test(text[at])) {
    at++;
  }
  const name = text.slice(from, at);
  let after = at;
  while (WHITESPACE.test(text[after] ?? '')) {
    after++;
  }
  if (text[after] !== '=') {
    return { name, value: null, quoted: false, end: at };
  }
  after++;
  while (WHITESPACE.test(text[after] ?? '')) {
    after++;
  }
  if (QUOTES.includes(text[after])) {
    const end = text.indexOf(text[after], after + 1);
    return { name, value: text.slice(after + 1, end < 0 ? text.length : end), quoted: true, end: end < 0 ? text.length : end + 1 };
  }
  if (text[after] === '{') {
    const end = closing(text, after, '{', '}');
    return { name, value: text.slice(after + 1, end), quoted: false, end: end + 1 };
  }
  const bare = /^[^\s/>]+/.exec(text.slice(after))?.[0] ?? '';

  return { name, value: bare, quoted: false, end: after + bare.length };
}

function propOf({ name, value, quoted }: Attribute): [string, unknown] | null {
  const bound = name.startsWith(VUE_BINDING);
  const key = bound ? name.slice(1) : name;
  if (!key || NOT_A_PROP.test(key)) {
    return null;
  }
  if (value === null) {
    return [key, true];
  }
  const literal = quoted && !bound ? value : literalOf(value);

  return literal === undefined ? null : [key, literal];
}

function propsOfTag(text: string, from: number): LiteralProps {
  const props: LiteralProps = {};
  let at = from;
  while (at < text.length && text[at] !== '>' && !text.startsWith('/>', at)) {
    if (WHITESPACE.test(text[at])) {
      at++;
      continue;
    }
    if (text[at] === '{') {
      at = closing(text, at, '{', '}') + 1;
      continue;
    }
    const attribute = attributeAt(text, at);
    const prop = propOf(attribute);
    if (prop) {
      props[prop[0]] = prop[1];
    }
    at = Math.max(attribute.end, at + 1);
  }

  return props;
}

export function literalPropsOf(code: string, name: string): LiteralProps | null {
  const opening = new RegExp(`<${name}(?=[\\s/>])`, 'g');
  for (const match of code.matchAll(opening)) {
    const props = propsOfTag(code, match.index + match[0].length);
    if (Object.keys(props).length > 0) {
      return props;
    }
  }

  return null;
}
