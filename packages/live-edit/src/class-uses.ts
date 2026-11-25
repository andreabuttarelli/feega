export type ClassUse = { name: string; line: number; col: number; dynamic: boolean; module: string | null };

type Markup = { attr: RegExp; directive?: RegExp; keys: boolean };

const MARKUP: Record<string, Markup> = {
  html: { attr: /\sclass\s*=\s*/g, keys: false },
  jsx: { attr: /\s(?:className|class)\s*=\s*/g, keys: true },
  tsx: { attr: /\s(?:className|class)\s*=\s*/g, keys: true },
  vue: { attr: /\s(?::class|v-bind:class|class)\s*=\s*/g, keys: true },
  svelte: { attr: /\sclass\s*=\s*/g, directive: /\sclass:([\w-]+)/g, keys: true },
  astro: { attr: /\s(?:class:list|class)\s*=\s*/g, keys: true }
};

const MODULE_IMPORT = /import\s+(\w+)\s+from\s+['"](\.{1,2}\/[^'"]+\.module\.css)['"]/g;
const HELPERS = /\b(?:clsx|cn|cx|classnames|classNames|true|false|null|undefined)\b/g;
const STRING_LITERAL = /'([^'\\]*)'|"([^"\\]*)"|`([^`]*)`/g;
const INTERPOLATION = /\$\{[^}]*\}|\{[^}]*\}/g;
const HAS_INTERPOLATION = /\$\{[^}]*\}|\{[^}]*\}/;
const OBJECT_KEY = /[{,]\s*(?:'([\w-]+)'|"([\w-]+)"|([\w-]+))\s*:/g;
const IDENTIFIER = /[A-Za-z_$][\w$]*/;

const extOf = (file: string) => file.slice(file.lastIndexOf('.') + 1);

function elementAt(text: string, at: number): { line: number; col: number } {
  const open = Math.max(text.lastIndexOf('<', at), 0);
  const before = text.slice(0, open).split('\n');
  return { line: before.length, col: before[before.length - 1].length + 1 };
}

const words = (value: string) => value.split(/\s+/).filter(Boolean);

function resolved(from: string, spec: string): string {
  const parts = from.split('/').slice(0, -1);
  for (const piece of spec.split('/')) {
    if (piece === '..') {
      parts.pop();
    } else if (piece !== '.') {
      parts.push(piece);
    }
  }
  return parts.join('/');
}

function bindingsOf(file: string, text: string): Map<string, string> {
  return new Map([...text.matchAll(MODULE_IMPORT)].map((m) => [m[1], resolved(file, m[2])]));
}

function closing(text: string, from: number, open: string, close: string): number {
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    depth += text[i] === open ? 1 : text[i] === close ? -1 : 0;
    if (depth === 0) {
      return i;
    }
  }
  return text.length - 1;
}

function valueAt(text: string, from: number): { value: string; quoted: boolean; end: number } | null {
  const first = text[from];
  if (first === '"' || first === "'") {
    const end = text.indexOf(first, from + 1);
    return end < 0 ? null : { value: text.slice(from + 1, end), quoted: true, end };
  }
  if (first === '{') {
    const end = closing(text, from, '{', '}');
    return { value: text.slice(from + 1, end), quoted: false, end };
  }
  return null;
}

type Found = { name: string; dynamic: boolean; module: string | null };

function fromQuoted(value: string, expression: boolean, keys: boolean, bindings: Map<string, string>): Found[] {
  if (expression) {
    return fromExpression(value, keys, bindings);
  }
  const stripped = value.replace(INTERPOLATION, ' ');
  const dynamic = stripped !== value;
  return words(stripped).map((name) => ({ name, dynamic, module: null }));
}

const MODULE_REF = /\b(\w+)(?:\.([A-Za-z_]\w*)|\[['"]([\w-]+)['"]\])/g;
const EMPTY_INTERPOLATION = /\$\{\s*\}/g;

type Item = { at: number; found: Found };

function fromExpression(value: string, keys: boolean, bindings: Map<string, string>): Found[] {
  const items: Item[] = [];
  const bare = value.replace(MODULE_REF, (whole, binding: string, dotted: string | undefined, bracketed: string | undefined, at: number) => {
    const sheet = bindings.get(binding);
    if (!sheet) {
      return whole;
    }
    items.push({ at, found: { name: dotted ?? bracketed!, dynamic: false, module: sheet } });
    return ' '.repeat(whole.length);
  }).replace(EMPTY_INTERPOLATION, (whole) => ' '.repeat(whole.length));

  for (const m of bare.matchAll(STRING_LITERAL)) {
    const text = m[1] ?? m[2] ?? m[3] ?? '';
    const interpolated = HAS_INTERPOLATION.test(text);
    words(text.replace(INTERPOLATION, ' ')).forEach((name) => items.push({ at: m.index!, found: { name, dynamic: interpolated, module: null } }));
  }

  let rest = bare.replace(STRING_LITERAL, ' ');
  if (keys) {
    for (const m of rest.matchAll(OBJECT_KEY)) {
      items.push({ at: m.index!, found: { name: m[1] ?? m[2] ?? m[3], dynamic: true, module: null } });
    }
    rest = rest.replace(OBJECT_KEY, ' ');
  }

  const conditional = IDENTIFIER.test(rest.replace(HELPERS, ' ')) || HAS_INTERPOLATION.test(rest);
  return items.sort((a, b) => a.at - b.at).map(({ found }) => ({ ...found, dynamic: found.dynamic || conditional }));
}

export function classUsesOf(file: string, text: string): ClassUse[] {
  const markup = MARKUP[extOf(file)];
  if (!markup) {
    return [];
  }
  const bindings = bindingsOf(file, text);
  const found: { at: number; uses: Found[] }[] = [];
  for (const m of text.matchAll(markup.attr)) {
    const from = m.index! + m[0].length;
    const read = valueAt(text, from);
    if (!read) {
      continue;
    }
    const expression = !read.quoted || /:class|class:list/.test(m[0]);
    found.push({ at: m.index!, uses: fromQuoted(read.value, expression, markup.keys, bindings) });
  }
  for (const m of markup.directive ? text.matchAll(markup.directive) : []) {
    found.push({ at: m.index!, uses: [{ name: m[1], dynamic: true, module: null }] });
  }
  return found
    .sort((a, b) => a.at - b.at)
    .flatMap(({ at, uses }) => uses.map((u) => ({ ...u, ...elementAt(text, at) })));
}
