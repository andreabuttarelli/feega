import { createRequire } from 'node:module';
import { parse as parseJs } from '@babel/parser';
import MagicString from 'magic-string';

export const SOURCE_ATTR = 'data-feega-src';

type Tag = { nameEnd: number; line: number; col: number };

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
    out.appendLeft(tag.nameEnd, ` ${SOURCE_ATTR}="${file}:${tag.line}:${tag.col}"`);
  }
  return out.toString();
}

function extensionOf(file: string): string {
  const clean = file.split('?')[0];
  return clean.slice(clean.lastIndexOf('.'));
}

function jsxTags(code: string, plugins: ('jsx' | 'typescript')[]): Tag[] {
  const ast = parseJs(code, { sourceType: 'module', plugins, errorRecovery: true });
  const tags: Tag[] = [];

  walk(ast.program as unknown as AstNode, (node) => {
    if (node.type !== 'JSXOpeningElement') {
      return;
    }

    const name = node.name as AstNode & { name?: string; end: number };
    if (name.type !== 'JSXIdentifier' || !HOST_TAG.test(name.name ?? '')) {
      return;
    }

    const start = (node.loc as { start: { line: number; column: number } }).start;
    tags.push({ nameEnd: name.end, line: start.line, col: start.column + 1 });
  });

  return tags;
}

function svelteTags(code: string): Tag[] {
  const { parse } = require('svelte/compiler') as { parse: (src: string, opts: { modern: true }) => AstNode };
  const ast = parse(code, { modern: true });
  const lineStarts = lineStartsOf(code);
  const tags: Tag[] = [];

  walk(ast.fragment as AstNode, (node) => {
    if (node.type !== 'RegularElement') {
      return;
    }

    const start = node.start as number;
    const nameEnd = start + 1 + (node.name as string).length;
    tags.push({ nameEnd, ...position(lineStarts, start) });
  });

  return tags;
}

const VUE_ELEMENT = 1;
const VUE_PLAIN_TAG = 0;

type VueNode = { type: number; tag?: string; tagType?: number; loc: { start: { offset: number } }; children?: VueNode[] };

function vueTags(code: string): Tag[] {
  const { parse } = require('@vue/compiler-sfc') as { parse: (src: string) => { descriptor: { template: { ast: VueNode } | null } } };
  const template = parse(code).descriptor.template;
  if (!template) {
    return [];
  }
  const lineStarts = lineStartsOf(code);
  const tags: Tag[] = [];
  const visit = (node: VueNode) => {
    if (node.type === VUE_ELEMENT && node.tagType === VUE_PLAIN_TAG && node.tag) {
      const start = node.loc.start.offset;
      tags.push({ nameEnd: start + 1 + node.tag.length, ...position(lineStarts, start) });
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
