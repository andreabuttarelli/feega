import type { FileChange } from './files';

export type SourceFile = { path: string; text: string };

type Rewrite = (family: string, to: string) => (text: string) => string;

const FONT_FACE = /@font-face\s*\{[^}]*\}/g;
const MASK = '\u0000';
const PLAIN_NAME = /^[\w-]+$/;
const SPACES = /\s+/g;

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const named = (to: string) => (PLAIN_NAME.test(to) ? to : `'${to}'`);

function inStack(family: string, to: string): (stack: string) => string {
  const quoted = new RegExp(`(?<![\\w-])(["'])${escaped(family)}\\1`, 'gi');
  const bare = new RegExp(`(?<=(?:^|[,\\[("'])\\s*)${escaped(family)}(?=\\s*(?:,|$|[;}"'!)\\]]))`, 'gi');
  return (stack) => stack.replace(quoted, (_, quote: string) => `${quote}${to}${quote}`).replace(bare, named(to));
}

const inDeclaration: Rewrite = (family, to) => {
  const swap = inStack(family, to);
  return (text) => text.replace(/((?<![\w-])(?:font-family|font|--[\w-]+)\s*:)([^;}\n]*)/g, (_, head: string, value: string) => head + swap(value));
};

const inScriptObject: Rewrite = (family, to) => {
  const swap = inStack(family, to);
  const region = /((?<![\w-])fontFamily\s*:\s*)(\[[^\]]*\]|\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|'[^'\n]*'|"[^"\n]*"|`[^`\n]*`)/g;
  return (text) => text.replace(region, (_, head: string, value: string) => head + swap(value));
};

const inUtilityClass: Rewrite = (family, to) => {
  const underscored = (name: string) => name.trim().replace(SPACES, '_');
  const utility = new RegExp(`font-\\[(["']?)${escaped(underscored(family))}\\1\\]`, 'gi');
  return (text) => text.replace(utility, (_, quote: string) => `font-[${quote}${underscored(to)}${quote}]`);
};

const REWRITES: Rewrite[] = [inDeclaration, inScriptObject, inUtilityClass];

export function replaceFamily(text: string, family: string, to: string): string {
  const faces: string[] = [];
  const masked = text.replace(FONT_FACE, (face) => `${MASK}${faces.push(face) - 1}${MASK}`);
  const rewritten = REWRITES.reduce((current, rewrite) => rewrite(family, to)(current), masked);
  return rewritten.replace(new RegExp(`${MASK}(\\d+)${MASK}`, 'g'), (_, index: string) => faces[Number(index)]);
}

const LOADING_LINK = /^[ \t]*<link\b[^>]*href=["']([^"']*fonts\.googleapis\.com\/css[^"']*)["'][^>]*>[ \t]*\n?/gm;
const LOADING_IMPORT = /^[ \t]*@import\s+url\(\s*["']?([^"')]*fonts\.googleapis\.com\/css[^"')]*)["']?\s*\)\s*;?[ \t]*\n?/gm;

function loadsOnly(url: string, family: string): boolean {
  const names = [...url.matchAll(/[?&]family=([^:&;@]+)/g)].map((m) => decodeURIComponent(m[1].replace(/\+/g, ' ')).toLowerCase());
  return names.length === 1 && names[0] === family.trim().toLowerCase();
}

function withoutLoading(text: string, family: string): string {
  const drop = (whole: string, url: string) => (loadsOnly(url, family) ? '' : whole);
  return text.replace(LOADING_LINK, drop).replace(LOADING_IMPORT, drop);
}

export function replaceEverywhere(files: SourceFile[], family: string, to: string): FileChange[] {
  return files
    .map(({ path, text }) => ({ path, before: text, after: withoutLoading(replaceFamily(text, family, to), family) }))
    .filter((change) => change.after !== change.before);
}
