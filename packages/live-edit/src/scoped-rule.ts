import { offsetOf, openTagEnd, type LiveAt } from './class-patch';
import type { ReadFile } from './files';
import type { TextWritten } from './literal-text';
import type { Css } from './style-attr';

const CLASS_LITERAL = /\sclass="([^"{}]*)"/;
const CLASS_ANY = /\sclass=/;
const STYLE_LITERAL = /\sstyle="([^"{}]*)"/;
const TAG_NAME = /^<([a-zA-Z][\w-]*)/;
const STYLE_BLOCK = /<style[^>]*>([\s\S]*?)<\/style>/;
const RULE_INDENT = '  ';
const REMOVED = '';
const EMPTY_STYLE = /\n*<style>\s*<\/style>\n?/;
const DECL_INDENT = '    ';

const kebab = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const componentOf = (file: string) => kebab(file.split('/').pop()!.replace(/\.[^.]+$/, '').replace(/^\+/, ''));
const escaped = (name: string) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function declarationsOf(text: string): Map<string, string> {
  const pairs = text
    .split(';')
    .map((d) => d.split(':').map((p) => p.trim()))
    .filter(([name, value]) => name && value);
  return new Map(pairs.map(([name, ...value]) => [name, value.join(':')]));
}

function freeClass(source: string, base: string): string {
  const taken = (name: string) => new RegExp(`[\\s"'.]${escaped(name)}[\\s"'{:,.]`).test(source);
  let name = base;
  for (let n = 2; taken(name); n++) {
    name = `${base}-${n}`;
  }
  return name;
}

const ruleText = (selector: string, all: Map<string, string>, indent = RULE_INDENT) => `${indent}${selector} {\n${[...all].map(([p, v]) => `${indent}${DECL_INDENT.slice(RULE_INDENT.length)}${p}: ${v};`).join('\n')}\n${indent}}`;

const MIN_WIDTH = /min-width:\s*([\d.]+)px/;
const MAX_WIDTH = /max-width:\s*([\d.]+)px/;

function mediaAt(body: string, index: number): string[] {
  const open: string[] = [];
  let header = '';
  for (const ch of body.slice(0, index)) {
    if (ch === '{') {
      open.push(header.trim());
      header = '';
      continue;
    }
    if (ch === '}') {
      open.pop();
      header = '';
      continue;
    }
    header = ch === ';' ? '' : header + ch;
  }
  return open.filter((h) => h.startsWith('@media'));
}

function appliesAt(media: string[], viewport: number | undefined): boolean {
  if (viewport === undefined) {
    return media.length === 0;
  }
  return media.every((m) => {
    const min = m.match(MIN_WIDTH);
    const max = m.match(MAX_WIDTH);
    return (!min || viewport >= Number(min[1])) && (!max || viewport <= Number(max[1]));
  });
}

const BOXES = ['padding', 'margin'];
const BOX_SIDES = ['top', 'right', 'bottom', 'left'];

function shorthanded(css: Map<string, string>, all: Map<string, string>): Map<string, string> {
  const merged = new Map(css);
  for (const box of BOXES) {
    const longhands = BOX_SIDES.map((side) => `${box}-${side}`);
    const values = longhands.map((name) => css.get(name));
    if (values.some((v) => !v)) {
      continue;
    }
    longhands.forEach((name) => (merged.delete(name), all.delete(name)));
    merged.set(box, values.every((v) => v === values[0]) ? values[0]! : values.join(' '));
  }
  return merged;
}

export const ruleInBody = (body: string, name: string, css: Map<string, string>, viewport?: number, indent = RULE_INDENT) => selectorInBody(body, `.${name}`, css, viewport, indent);

export function selectorInBody(body: string, selector: string, css: Map<string, string>, viewport?: number, indent = RULE_INDENT): string {
  const rules = [...body.matchAll(new RegExp(`(^|\\n)([ \\t]*)${escaped(selector)}\\s*\\{([^}]*)\\}`, 'g'))];
  const found = rules.filter((r) => appliesAt(mediaAt(body, r.index!), viewport)).pop();
  const all = found ? declarationsOf(found[3]) : new Map<string, string>();
  shorthanded(css, all).forEach((value, prop) => (value === REMOVED ? all.delete(prop) : all.set(prop, value)));
  if (found && !all.size) {
    return body.slice(0, found.index!) + body.slice(found.index! + found[0].length).replace(/^\n(?=\s*\n)/, '');
  }
  if (found) {
    return body.slice(0, found.index!) + found[1] + ruleText(selector, all, found[2]) + body.slice(found.index! + found[0].length);
  }
  if (!all.size) {
    return body;
  }
  const head = body.trimEnd();
  return `${head}${head ? '\n' : ''}${indent === '' && head ? '\n' : ''}${ruleText(selector, all, indent)}\n`;
}

function withRule(source: string, name: string, css: Map<string, string>, viewport?: number): string {
  const block = source.match(STYLE_BLOCK);
  if (!block && [...css.values()].every((v) => v === REMOVED)) {
    return source;
  }
  if (!block) {
    return `${source.trimEnd()}\n\n<style>\n${ruleText(`.${name}`, css)}\n</style>\n`;
  }
  const body = block[1];
  const after = source.replace(STYLE_BLOCK, (whole) => whole.replace(body, ruleInBody(body, name, css, viewport)));
  return after.replace(EMPTY_STYLE, '\n');
}

const INNER_REACH: Record<string, (inner: string) => string> = {
  svelte: (inner) => `:global(${inner})`,
  vue: (inner) => `:deep(${inner})`
};

const reach = (file: string, inner: string) => (INNER_REACH[file.slice(file.lastIndexOf('.') + 1)] ?? ((i: string) => i))(inner);

export enum Scope {
  Element = 'element',
  Class = 'class'
}

export const hasRule = (body: string, selector: string) => new RegExp(`(^|\\n)[ \\t]*${escaped(selector)}\\s*\\{`).test(body);

export const usesOf = (source: string, name: string) => [...source.matchAll(/\sclass="([^"{}]*)"/g)].filter((m) => m[1].split(/\s+/).includes(name)).length;

function classFor(classes: string[], source: string, base: string, scope: Scope): { name: string; added: boolean } {
  if (scope === Scope.Class && classes.length) {
    return { name: classes[0], added: false };
  }
  const styles = source.match(STYLE_BLOCK)?.[1] ?? '';
  const reusable = classes.find((c) => c === base || new RegExp(`^${escaped(base)}-\\d+$`).test(c)) ?? classes.find((c) => hasRule(styles, `.${c}`) && usesOf(source, c) === 1);
  return reusable ? { name: reusable, added: false } : { name: freeClass(source, base), added: true };
}

export async function scopedRule(read: ReadFile, at: LiveAt, css: Css, viewport?: number, scope = Scope.Element, inner?: string): Promise<TextWritten> {
  const text = await read(at.file);
  const start = text === null ? -1 : offsetOf(text, at);
  const end = start < 0 || text![start] !== '<' ? -1 : openTagEnd(text!, start);
  if (end < 0) {
    return { ok: false, reason: `${at.file}:${at.line}: the element is not where the page says` };
  }

  const source = text!;
  let open = source.slice(start, end + 1);
  const literal = open.match(CLASS_LITERAL);
  if (!literal && CLASS_ANY.test(open)) {
    return { ok: false, reason: `${at.file}:${at.line}: class is an expression, not written`, at };
  }

  const declared = new Map<string, string>();
  const inline = open.match(STYLE_LITERAL);
  if (inline && !inner) {
    declarationsOf(inline[1]).forEach((value, prop) => declared.set(prop, value));
    open = open.replace(STYLE_LITERAL, '');
  }
  Object.entries(css).forEach(([prop, value]) => declared.set(prop, value));

  const classes = literal?.[1].split(/\s+/).filter(Boolean) ?? [];
  const { name, added } = classFor(classes, source, `${componentOf(at.file)}-${open.match(TAG_NAME)![1].toLowerCase()}`, scope);
  if (added) {
    const closing = open.endsWith('/>') ? open.length - 2 : open.length - 1;
    open = literal ? open.replace(CLASS_LITERAL, ` class="${[...classes, name].join(' ')}"`) : `${open.slice(0, closing).trimEnd()} class="${name}"${open.slice(closing)}`;
  }

  const tagged = source.slice(0, start) + open + source.slice(end + 1);
  const selector = inner ? `${name} ${reach(at.file, inner)}` : name;
  return { ok: true, change: { path: at.file, before: source, after: withRule(tagged, selector, declared, viewport) } };
}
