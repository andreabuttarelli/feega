import { Delimiter, type Attribute } from './open-tag';

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export type Syntax = {
  bindings: (prop: string) => string[];
  string: (prop: string, value: string) => string | null;
  expression: (prop: string, js: string) => string | null;
  flag: (prop: string) => string;
  expressionIn: (attribute: Attribute) => boolean;
};

const DATE_MARK = '$date';
const FUNCTION_MARK = '$fn';
const NEEDS_EXPRESSION = /["\\{}\r\n<>&]/;
const PLAIN_LITERAL = /^\s*(?:(['"`])[^'"`$\\]*\1|-?\d+(?:\.\d+)?|true|false|null)\s*$/;
const SPREAD = /^\.\.\./;
const VUE_BIND = /^(?::|v-bind:)/;

const camelToKebab = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const braces = (prop: string, js: string) => `${prop}={${js}}`;

const textOf = (prop: string, value: string) => `${prop}="${value}"`;

const braced: Omit<Syntax, 'bindings'> = {
  string: (prop, value) => (NEEDS_EXPRESSION.test(value) ? braces(prop, JSON.stringify(value)) : textOf(prop, value)),
  expression: braces,
  flag: (prop) => prop,
  expressionIn: (attribute) => attribute.delimiter === Delimiter.Brace && !PLAIN_LITERAL.test(attribute.value ?? '')
};

const quoted = (prop: string, js: string): string | null => {
  if (!js.includes('"')) {
    return `:${prop}="${js}"`;
  }
  return js.includes("'") ? null : `:${prop}='${js}'`;
};

const VUE: Syntax = {
  bindings: (prop) => [...new Set([prop, camelToKebab(prop)])].flatMap((name) => [name, `:${name}`, `v-bind:${name}`]),
  string: (prop, value) => (NEEDS_EXPRESSION.test(value) ? quoted(prop, JSON.stringify(value)) : textOf(prop, value)),
  expression: quoted,
  flag: (prop) => prop,
  expressionIn: (attribute) => VUE_BIND.test(attribute.name) && !PLAIN_LITERAL.test(attribute.value ?? '')
};

const BRACED: Syntax = { ...braced, bindings: (prop) => [prop] };

export const SYNTAX: Record<string, Syntax> = {
  '.tsx': BRACED,
  '.jsx': BRACED,
  '.svelte': BRACED,
  '.astro': BRACED,
  '.vue': VUE
};

export const syntaxOf = (file: string): Syntax | null => SYNTAX[file.slice(file.lastIndexOf('.'))] ?? null;

export const spreads = (attribute: Attribute): boolean => (attribute.delimiter === Delimiter.Shorthand && SPREAD.test(attribute.name)) || attribute.name === 'v-bind';

export const isMarked = (value: unknown, mark: string): boolean => typeof value === 'object' && value !== null && mark in value;

export const isCallback = (value: unknown): boolean => isMarked(value, FUNCTION_MARK);

export function jsOf(value: Json): string {
  if (isMarked(value, DATE_MARK)) {
    return `new Date(${JSON.stringify((value as { $date: string })[DATE_MARK])})`;
  }
  if (Array.isArray(value)) {
    return `[${value.map(jsOf).join(',')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    return `{${Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}:${jsOf(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function attributeFor(syntax: Syntax, prop: string, value: Json): string | null {
  if (value === true) {
    return syntax.flag(prop);
  }
  return typeof value === 'string' ? syntax.string(prop, value) : syntax.expression(prop, jsOf(value));
}
