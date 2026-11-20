import { offsetOf, openTagEnd, type LiveAt } from './class-patch';
import type { ReadFile } from './files';
import { GLOBAL_SHEETS } from './font-wiring';
import { declarationsOf } from './scoped-rule';

export enum OffsetSide {
  Top = 'top',
  Right = 'right',
  Bottom = 'bottom',
  Left = 'left'
}

export const OFFSET_SIDES = Object.values(OffsetSide);

const ALL_SIDES = OFFSET_SIDES;

const CLASS_SIDES: Record<string, OffsetSide[]> = {
  inset: ALL_SIDES,
  'inset-x': [OffsetSide.Left, OffsetSide.Right],
  'inset-y': [OffsetSide.Top, OffsetSide.Bottom],
  top: [OffsetSide.Top],
  right: [OffsetSide.Right],
  bottom: [OffsetSide.Bottom],
  left: [OffsetSide.Left]
};

const PROPERTY_SIDES: Record<string, OffsetSide[]> = {
  inset: ALL_SIDES,
  'inset-inline': [OffsetSide.Left, OffsetSide.Right],
  'inset-block': [OffsetSide.Top, OffsetSide.Bottom],
  top: [OffsetSide.Top],
  right: [OffsetSide.Right],
  bottom: [OffsetSide.Bottom],
  left: [OffsetSide.Left]
};

const AUTO = 'auto';
const STYLE_BLOCK = /<style[^>]*>([\s\S]*?)<\/style>/;
const STYLE_LITERAL = /\sstyle="([^"{}]*)"/;
const CLASS_LITERAL = /\s(?:class|className)="([^"{}]*)"/;
const MODULE_REFS = /\b(\w+)\.([A-Za-z_]\w*)\b/g;
const CSS_IMPORT = /import\s+(?:(\w+)\s+from\s+)?['"](\.{1,2}\/[^'"]+\.css)['"]/g;
const RULE_BODY = '[ \\t]*\\{([^{}]*)\\}';

const inOrder = (found: Set<OffsetSide>) => OFFSET_SIDES.filter((side) => found.has(side));

const dirOf = (file: string) => file.slice(0, file.lastIndexOf('/') + 1);

function joinPath(dir: string, relative: string): string {
  const parts = dir.split('/').filter(Boolean);
  for (const piece of relative.split('/')) {
    if (piece === '..') {
      parts.pop();
    } else if (piece !== '.') {
      parts.push(piece);
    }
  }
  return parts.join('/');
}

export function offsetSidesOfClasses(classes: string): OffsetSide[] {
  const found = classes
    .split(/\s+/)
    .filter((c) => !c.includes(':'))
    .map((c) => c.replace(/^-/, '').replace(/-[^-]+$/, ''))
    .flatMap((family) => CLASS_SIDES[family] ?? []);
  return inOrder(new Set(found));
}

function sidesOfDeclarations(declared: Map<string, string>): OffsetSide[] {
  const found = [...declared].filter(([, value]) => value !== AUTO).flatMap(([property]) => PROPERTY_SIDES[property] ?? []);
  return inOrder(new Set(found));
}

const escaped = (name: string) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function sidesOfRules(css: string, names: string[]): OffsetSide[] {
  const bodies = names.flatMap((name) => [...css.matchAll(new RegExp(`(?:^|\\n)[ \\t]*\\.${escaped(name)}\\s*${RULE_BODY}`, 'g'))].map((m) => m[1]));
  return sidesOfDeclarations(declarationsOf(bodies.join(';')));
}

export async function authoredOffsets(read: ReadFile, at: LiveAt): Promise<OffsetSide[]> {
  const source = await read(at.file);
  const start = source === null ? -1 : offsetOf(source, at);
  const end = start < 0 || source![start] !== '<' ? -1 : openTagEnd(source!, start);
  if (end < 0) {
    return [];
  }

  const text = source!;
  const open = text.slice(start, end + 1);
  const found = new Set<OffsetSide>();
  const add = (sides: OffsetSide[]) => sides.forEach((side) => found.add(side));

  add(sidesOfDeclarations(declarationsOf(open.match(STYLE_LITERAL)?.[1] ?? '')));

  const literal = open.match(CLASS_LITERAL)?.[1] ?? '';
  add(offsetSidesOfClasses(literal));

  const names = literal.split(/\s+/).filter(Boolean);
  const modules = new Map<string, string[]>();
  for (const [, binding, name] of open.matchAll(MODULE_REFS)) {
    modules.set(binding, [...(modules.get(binding) ?? []), name]);
  }

  const style = text.match(STYLE_BLOCK)?.[1];
  if (style) {
    add(sidesOfRules(style, names));
  }

  for (const [, binding, path] of text.matchAll(CSS_IMPORT)) {
    const css = await read(joinPath(dirOf(at.file), path));
    const used = binding ? (modules.get(binding) ?? []) : names;
    add(css === null ? [] : sidesOfRules(css, used));
  }

  for (const sheet of GLOBAL_SHEETS) {
    const css = await read(sheet);
    add(css === null ? [] : sidesOfRules(css, names));
  }

  return inOrder(found);
}
