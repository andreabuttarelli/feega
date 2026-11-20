import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const NODE_LIST = /(?:\bnode"?\s*:|[iI]conNode\s*=|createLucideIcon\(\s*"[^"]+"\s*,)\s*(?=\[)/;
const UNQUOTED_KEY = /([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g;
const SVG_OPEN =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
const REACT_KEY = 'key';
const SHAPE_CALL = /createElement\(\s*"(path|circle|rect|line|polyline|polygon|ellipse)"\s*,\s*\{([^}]*)\}/g;
const SVG_CALL = /createElement\(\s*"svg"[\s\S]*?\}\s*,\s*props/;
const ATTRIBUTE = /(?:"([\w-]+)"|(\w+))\s*:\s*(?:"([^"]*)"|([\d.]+))/g;
const REGULAR_WEIGHT = /"regular"\s*,([\s\S]*?)\]\s*(?:,\s*\[|\]\s*\))/;
const RELATIVE_IMPORT = /from\s*["'](\.{1,2}\/[^"']+)["']/g;
const SHARED_MODULE = /(?:^|\/)(?:Icon\.svelte|create\w+\.m?js|lib\/.*)$/;
const MODULE_DEPTH = 3;
const PHOSPHOR_VIEWBOX = '0 0 256 256';
const DEFAULT_VIEWBOX = '0 0 24 24';
const NOT_DRAWN = new Set(['title', 'ref', 'xmlns', 'aria-hidden', 'aria-labelledby', 'data-slot']);
const QUOTE = '"';

type Shape = [string, Record<string, string | number>];

function balanced(text: string, start: number): string | null {
  let depth = 0;
  let quoted = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      quoted = !(char === QUOTE && text[i - 1] !== '\\');
      continue;
    }
    if (char === QUOTE) {
      quoted = true;
    }
    depth += char === '[' ? 1 : char === ']' ? -1 : 0;
    if (depth === 0) {
      return text.slice(start, i + 1);
    }
  }
  return null;
}

const attribute = ([name, value]: [string, string | number]) => ` ${name}="${String(value).replace(/"/g, '&quot;')}"`;

const shapeSvg = ([tag, attrs]: Shape) =>
  `<${tag}${Object.entries(attrs).filter(([name]) => name !== REACT_KEY).map(attribute).join('')}/>`;

const kebab = (name: string) => name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

function attributesOf(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [, quoted, bare, string, number] of text.matchAll(ATTRIBUTE)) {
    const name = kebab(quoted ?? bare);
    if (!NOT_DRAWN.has(name)) {
      out[name] = string ?? number;
    }
  }
  return out;
}

function elementsSvg(source: string): string | null {
  const weight = REGULAR_WEIGHT.exec(source);
  const body = weight ? weight[1] : source;
  const shapes = [...body.matchAll(SHAPE_CALL)].map(([, tag, attrs]) => `<${tag}${Object.entries(attributesOf(attrs)).map(attribute).join('')}/>`);
  if (!shapes.length) {
    return null;
  }

  const root = SVG_CALL.exec(source);
  const own = root ? attributesOf(root[0]) : { viewBox: PHOSPHOR_VIEWBOX, fill: 'currentColor' };
  const viewBox = own['view-box'] ?? DEFAULT_VIEWBOX;
  const rest = Object.entries(own).filter(([name]) => name !== 'view-box').map(attribute).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${rest}>${shapes.join('')}</svg>`;
}

function nodeListSvg(source: string): string | null {
  const found = NODE_LIST.exec(source);
  const literal = found ? balanced(source, found.index + found[0].length) : null;
  if (!literal) {
    return null;
  }

  try {
    const shapes = JSON.parse(literal.replace(UNQUOTED_KEY, `$1"$2":`)) as Shape[];
    return `${SVG_OPEN}${shapes.map(shapeSvg).join('')}</svg>`;
  } catch {
    return null;
  }
}

export const svgOfSource = (source: string) => nodeListSvg(source) ?? elementsSvg(source);

export async function svgOfModule(path: string, seen: Set<string> = new Set()): Promise<string | null> {
  if (seen.has(path) || seen.size >= MODULE_DEPTH * MODULE_DEPTH) {
    return null;
  }
  seen.add(path);

  const source = await readFile(path, 'utf8').catch(() => null);
  if (source === null) {
    return null;
  }

  const own = svgOfSource(source);
  if (own) {
    return own;
  }

  for (const [, spec] of source.matchAll(RELATIVE_IMPORT)) {
    if (SHARED_MODULE.test(spec)) {
      continue;
    }
    const svg = await svgOfModule(join(dirname(path), spec), seen);
    if (svg) {
      return svg;
    }
  }
  return null;
}
