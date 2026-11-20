import { createRequire } from 'node:module';
import { parse as parseJs } from '@babel/parser';
import MagicString from 'magic-string';
import { iconImports, pascalOf } from './icon-imports.ts';

export const SOURCE_ATTR = 'data-feega-src';
export const ICON_ATTR = 'data-feega-icon';

type Tag = { nameEnd: number; line: number; col: number; icon?: string };

type Finder = (code: string) => Tag[];

type AstNode = { type?: string; [key: string]: unknown };

const require = createRequire(import.meta.url);

const HOST_TAG = /^[a-z][\w-]*$/;

const FINDERS: Record<string, Finder> = {
  '.jsx': (code) => jsxTags(code, ['jsx']),
  '.tsx': (code) => jsxTags(code, ['jsx', 'typescript']),
  '.svelte': svelteTags,
  '.vue': vueTags
};

export const MAPPED_EXTENSIONS = Object.keys(FINDERS);

export function injectSource(code: string, file: string): string | null {
  const finder = FINDERS[extensionOf(file)];
  if (!finder || code.includes(SOURCE_ATTR)) {
    return null;
  }

  const tags = finder(code);
  if (tags.length === 0) {
    return null;
  }

  const out = new MagicString(code);
  for (const tag of tags) {
    const icon = tag.icon ? ` ${ICON_ATTR}="${tag.icon}"` : '';
    out.appendLeft(tag.nameEnd, ` ${SOURCE_ATTR}="${file}:${tag.line}:${tag.col}"${icon}`);
  }
  return out.toString();
}

function extensionOf(file: string): string {
  const clean = file.split('?')[0];
  return clean.slice(clean.lastIndexOf('.'));
}

function jsxTags(code: string, plugins: ('jsx' | 'typescript')[]): Tag[] {
  const ast = parseJs(code, { sourceType: 'module', plugins, errorRecovery: true });
  const icons = iconImports(code);
  const tags: Tag[] = [];

  walk(ast.program as unknown as AstNode, (node) => {
    if (node.type !== 'JSXOpeningElement') {
      return;
    }

    const name = node.name as AstNode & { name?: string; end: number };
    const icon = icons.get(name.name ?? '');
    if (name.type !== 'JSXIdentifier' || !(HOST_TAG.test(name.name ?? '') || icon)) {
      return;
    }

    const start = (node.loc as { start: { line: number; column: number } }).start;
    tags.push({ nameEnd: name.end, line: start.line, col: start.column + 1, icon });
  });

  return tags;
}

function svelteTags(code: string): Tag[] {
  const { parse } = require('svelte/compiler') as { parse: (src: string, opts: { modern: true }) => AstNode };
  const ast = parse(code, { modern: true });
  const lineStarts = lineStartsOf(code);
  const icons = iconImports(code);
  const tags: Tag[] = [];

  walk(ast.fragment as AstNode, (node) => {
    const icon = node.type === 'Component' ? icons.get(node.name as string) : undefined;
    if (node.type !== 'RegularElement' && !icon) {
      return;
    }

    const start = node.start as number;
    const nameEnd = start + 1 + (node.name as string).length;
    tags.push({ nameEnd, ...position(lineStarts, start), icon });
  });

  return tags;
}

const VUE_ELEMENT = 1;
const VUE_PLAIN_TAG = 0;
const VUE_COMPONENT_TAG = 1;

type VueNode = { type: number; tag?: string; tagType?: number; loc: { start: { offset: number } }; children?: VueNode[] };

function vueTags(code: string): Tag[] {
  const { parse } = require('@vue/compiler-sfc') as { parse: (src: string) => { descriptor: { template: { ast: VueNode } | null } } };
  const template = parse(code).descriptor.template;
  if (!template) {
    return [];
  }
  const lineStarts = lineStartsOf(code);
  const icons = iconImports(code);
  const tags: Tag[] = [];
  const visit = (node: VueNode) => {
    const icon = node.tagType === VUE_COMPONENT_TAG && node.tag ? icons.get(pascalOf(node.tag)) : undefined;
    if (node.type === VUE_ELEMENT && node.tag && (node.tagType === VUE_PLAIN_TAG || icon)) {
      const start = node.loc.start.offset;
      tags.push({ nameEnd: start + 1 + node.tag.length, ...position(lineStarts, start), icon });
    }
    node.children?.forEach(visit);
  };
  template.ast.children?.forEach(visit);
  return tags;
}

function lineStartsOf(code: string): number[] {
  const starts = [0];
  for (let i = 0; i < code.length; i++) {
    if (code[i] === '\n') {
      starts.push(i + 1);
    }
  }
  return starts;
}

function position(lineStarts: number[], offset: number): { line: number; col: number } {
  let line = 0;
  while (line + 1 < lineStarts.length && lineStarts[line + 1] <= offset) {
    line++;
  }
  return { line: line + 1, col: offset - lineStarts[line] + 1 };
}

function walk(node: unknown, visit: (node: AstNode) => void): void {
  if (Array.isArray(node)) {
    node.forEach((child) => walk(child, visit));
    return;
  }
  if (!node || typeof node !== 'object') {
    return;
  }

  const record = node as AstNode;
  if (typeof record.type === 'string') {
    visit(record);
  }
  for (const [key, value] of Object.entries(record)) {
    if (key === 'loc' || key === 'parent') {
      continue;
    }
    walk(value, visit);
  }
}
