import { offsetOf, openTagEnd, type LiveAt } from './class-patch';
import { MODULE_EXTENSIONS, dirOf, joined } from './data-source';
import type { ReadFile } from './files';
import { hiddenOut, parentOf } from './move-node';

export type Piece = { start: number; end: number };

export type Refused = { reason: string; at?: LiveAt };

export type LoopHead = { at: number; expression: string; item: string };

export type ArrayLiteral = { path: string; text: string; open: number; close: number; pieces: Piece[] };

export type LoopArray = { array: ArrayLiteral; head: LoopHead };

const OPENERS = '([{';
const CLOSERS = ')]}';
const QUOTES = '"\'`';
const PLAIN_NAME = /^[A-Za-z_$][\w$]*$/;
const V_FOR = /\sv-for="\s*\(?\s*([^"]*?)\s*\)?\s+(?:in|of)\s+([^"]+?)\s*"/;
const EACH = /\{#each\s+|\{\/each\}/g;
const AS = /\s+as\s+/g;
const MAP = /\.map\(/g;
const MAP_PARAMETER = /^\s*\(?\s*/;
const IDENTIFIER = /^[A-Za-z_$][\w$]*/;
const COMMENT = /\/\/[^\n]*|\/\*[\s\S]*?\*\//g;
const EXPRESSION_CHARACTER = /[\w$.?!]/;
const WRAPPERS = '(?:(?:\\$state(?:\\.raw)?|ref|shallowRef|reactive)\\()?';

const ALIASES: Record<string, string> = { '$lib/': 'src/lib/', '@/': 'src/', '~/': 'src/' };

const NO_LOOP = 'the element is not rendered by a loop in this file: move it in the markup';
const NESTED_LOOPS = 'the element sits in nested loops: edit the data source by hand';

const EXPRESSION_REFUSALS: { applies: RegExp; reason: (expression: string) => string }[] = [
  { applies: /^$/, reason: () => 'the loop runs over an expression, not a plain array' },
  { applies: /\(/, reason: (expression) => `the loop runs over \`${expression}\`, a function call or chain, not an array literal` },
  { applies: /./, reason: (expression) => `the loop reads \`${expression}\`, a property, not an array literal` }
];

const notDeclared = (name: string) => `\`${name}\` is not an array literal in this file or in a file it imports (props, fetched data or a store): change the order in the data source`;
const notLiteral = (name: string) => `\`${name}\` is built by an expression, not an array literal: change the order in the data source`;
const spreads = (name: string) => `\`${name}\` spreads other arrays: change the source arrays instead`;

const escaped = (name: string) => name.replace(/\$/g, '\\$&');

function patternAt(text: string, from: number): string {
  if (!'{['.includes(text[from] ?? '')) {
    return text.slice(from).match(IDENTIFIER)?.[0] ?? '';
  }
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    depth += OPENERS.includes(text[i]) ? 1 : CLOSERS.includes(text[i]) ? -1 : 0;
    if (depth === 0) {
      return text.slice(from, i + 1);
    }
  }
  return '';
}

function eachHeads(text: string, until: number): LoopHead[] {
  const open: LoopHead[] = [];
  EACH.lastIndex = 0;
  for (let m = EACH.exec(text); m && m.index < until; m = EACH.exec(text)) {
    if (m[0] === '{/each}') {
      open.pop();
      continue;
    }
    AS.lastIndex = EACH.lastIndex;
    const as = AS.exec(text);
    if (as) {
      open.push({ at: m.index, expression: text.slice(EACH.lastIndex, as.index).trim(), item: patternAt(text, AS.lastIndex) });
    }
  }
  return open;
}

function expressionBefore(text: string, end: number): string {
  let i = end - 1;
  while (i >= 0) {
    if (text[i] === ')') {
      let depth = 0;
      for (; i >= 0; i--) {
        depth += text[i] === ')' ? 1 : text[i] === '(' ? -1 : 0;
        if (depth === 0) {
          break;
        }
      }
      i--;
      continue;
    }
    if (!EXPRESSION_CHARACTER.test(text[i])) {
      break;
    }
    i--;
  }
  return text.slice(i + 1, end).trim();
}

function mapHeads(text: string, until: number): LoopHead[] {
  const before = text.slice(0, until);
  const heads: LoopHead[] = [];
  for (const call of before.matchAll(MAP)) {
    const rest = before.slice(call.index + call[0].length);
    const depth = [...rest].reduce((sum, ch) => sum + (ch === '(' ? 1 : ch === ')' ? -1 : 0), 1);
    if (depth > 0) {
      heads.push({ at: call.index, expression: expressionBefore(text, call.index), item: patternAt(rest, rest.match(MAP_PARAMETER)![0].length) });
    }
  }
  return heads;
}

function vueHeads(text: string, start: number): LoopHead[] {
  const heads: LoopHead[] = [];
  for (let at = start; at >= 0; at = parentOf(text, at)) {
    const found = text.slice(at, openTagEnd(text, at) + 1).match(V_FOR);
    if (found) {
      heads.push({ at, expression: found[2], item: patternAt(found[1], 0) });
    }
  }
  return heads;
}

export const loopsAt = (text: string, start: number): LoopHead[] => [...vueHeads(text, start), ...eachHeads(text, start), ...mapHeads(text, start)].sort((a, b) => a.at - b.at);

export function piecesOf(source: string, open: number): Piece[] | null {
  const closer = CLOSERS[OPENERS.indexOf(source[open])];
  const pieces: Piece[] = [];
  let depth = 0;
  let quote = '';
  let from = open + 1;
  for (let i = open + 1; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      quote = ch === quote && source[i - 1] !== '\\' ? '' : quote;
      continue;
    }
    if (QUOTES.includes(ch)) {
      quote = ch;
      continue;
    }
    if (ch === '/' && (source[i + 1] === '/' || source[i + 1] === '*')) {
      const end = source[i + 1] === '/' ? source.indexOf('\n', i) : source.indexOf('*/', i + 2) + 1;
      i = end <= 0 ? source.length : end;
      continue;
    }
    depth += OPENERS.includes(ch) ? 1 : 0;
    const last = depth === 0 && ch === closer;
    depth -= CLOSERS.includes(ch) && !last ? 1 : 0;
    if ((ch === ',' && depth === 0) || last) {
      pieces.push({ start: from, end: i });
      from = i + 1;
    }
    if (last) {
      return pieces.map((p) => trimmed(source, p)).filter((p) => source.slice(p.start, p.end).replace(COMMENT, '').trim());
    }
  }
  return null;
}

function trimmed(source: string, piece: Piece): Piece {
  const text = source.slice(piece.start, piece.end);
  const lead = text.length - text.trimStart().length;
  return { start: piece.start + lead, end: piece.start + lead + text.trim().length };
}

function located(text: string, file: string, offset: number): LiveAt {
  const lines = text.slice(0, offset).split('\n');
  return { file, line: lines.length, col: lines[lines.length - 1].length + 1 };
}

function literalArray(file: string, text: string, name: string): ArrayLiteral | Refused | null {
  const declared = new RegExp(`\\b(?:const|let|var)\\s+${escaped(name)}(?![\\w$])\\s*(?::[^=]+?)?=\\s*(${WRAPPERS}\\[)?`).exec(text);
  if (!declared) {
    return null;
  }

  const at = located(text, file, declared.index);
  if (!declared[1]) {
    return { reason: notLiteral(name), at };
  }

  const open = declared.index + declared[0].length - 1;
  const pieces = piecesOf(text, open);
  if (!pieces) {
    return { reason: notLiteral(name), at };
  }
  if (pieces.some((p) => text.slice(p.start, p.end).startsWith('...'))) {
    return { reason: spreads(name), at };
  }

  return { path: file, text, open, close: text.indexOf(']', pieces.at(-1)?.end ?? open), pieces };
}

function moduleBase(file: string, specifier: string): string | null {
  if (specifier.startsWith('.')) {
    return joined(dirOf(file), specifier);
  }

  const alias = Object.keys(ALIASES).find((prefix) => specifier.startsWith(prefix));
  if (!alias) {
    return null;
  }

  const root = file.startsWith('src/') ? '' : file.slice(0, file.indexOf('/src/') + 1);
  return root + ALIASES[alias] + specifier.slice(alias.length);
}

async function importedArray(read: ReadFile, file: string, text: string, name: string): Promise<ArrayLiteral | Refused | null> {
  const from = text.match(new RegExp(`import\\s+(?:type\\s+)?\\{[^}]*\\b${escaped(name)}\\b[^}]*\\}\\s*from\\s*['"]([^'"]+)['"]`));
  const base = from && moduleBase(file, from[1]);
  if (!base) {
    return null;
  }

  for (const extension of MODULE_EXTENSIONS) {
    const body = await read(base + extension);
    if (body !== null) {
      return literalArray(base + extension, body, name);
    }
  }
  return null;
}

export async function arrayOf(read: ReadFile, file: string, text: string, name: string): Promise<ArrayLiteral | Refused> {
  const found = literalArray(file, text, name) ?? (await importedArray(read, file, text, name));
  return found ?? { reason: notDeclared(name) };
}

export async function loopArray(read: ReadFile, at: LiveAt): Promise<LoopArray | Refused> {
  const source = await read(at.file);
  if (source === null) {
    return { reason: `${at.file}: cannot read the file` };
  }

  const heads = loopsAt(hiddenOut(source), offsetOf(source, at));
  if (heads.length !== 1) {
    return { reason: heads.length ? NESTED_LOOPS : NO_LOOP, at };
  }

  const head = heads[0];
  if (!PLAIN_NAME.test(head.expression)) {
    return { reason: EXPRESSION_REFUSALS.find((r) => r.applies.test(head.expression))!.reason(head.expression), at };
  }

  const array = await arrayOf(read, at.file, source, head.expression);
  return 'reason' in array ? array : { array, head };
}
