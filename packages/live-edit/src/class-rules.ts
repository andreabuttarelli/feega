import postcss, { type AtRule, type Container, type Rule } from 'postcss';

export enum ClassScope {
  Global = 'global',
  Module = 'module',
  Component = 'component'
}

export type RuleSite = { file: string; line: number; selector: string; state: string; media: string; declarations: Record<string, string>; own: boolean };

export type SheetRule = RuleSite & { name: string; scope: ClassScope };

type Block = { css: string; open: string; line: number };

type StyleKind = { blocks: (text: string) => Block[]; scope: (file: string, open: string) => ClassScope };

const STYLE_BLOCK = /<style([^>]*)>([\s\S]*?)<\/style>/g;
const CLASS_NAME = /\.(-?[_a-zA-Z][\w-]*)/g;
const GLOBAL_OPEN = ':global(';
const PSEUDO = /(?:::?[\w-]+(?:\([^)]*\))?)*/;
const NO_BLOCK_OPEN = '';
const FIRST_LINE = 1;

const wholeFile = (text: string): Block[] => [{ css: text, open: NO_BLOCK_OPEN, line: FIRST_LINE }];

const styleBlocks = (text: string): Block[] =>
  [...text.matchAll(STYLE_BLOCK)].map((m) => ({ css: m[2], open: m[1], line: text.slice(0, m.index! + m[0].indexOf('>') + 1).split('\n').length }));

const always = (scope: ClassScope) => () => scope;

const STYLE_KINDS: Record<string, StyleKind> = {
  css: { blocks: wholeFile, scope: (file) => (file.endsWith('.module.css') ? ClassScope.Module : ClassScope.Global) },
  html: { blocks: styleBlocks, scope: always(ClassScope.Global) },
  svelte: { blocks: styleBlocks, scope: always(ClassScope.Component) },
  astro: { blocks: styleBlocks, scope: (_, open) => (/\bis:global\b/.test(open) ? ClassScope.Global : ClassScope.Component) },
  vue: { blocks: styleBlocks, scope: (_, open) => (/\bscoped\b/.test(open) ? ClassScope.Component : ClassScope.Global) }
};

const extOf = (file: string) => file.slice(file.lastIndexOf('.') + 1);

const insideGlobal = (selector: string, at: number) => {
  const before = selector.slice(0, at);
  return before.lastIndexOf(GLOBAL_OPEN) > before.lastIndexOf(')');
};

function mediaOf(rule: Rule): string | null {
  const queries: string[] = [];
  for (let node: Container | undefined = rule.parent; node && node.type !== 'root'; node = node.parent) {
    const at = node as AtRule;
    if (at.name?.endsWith('keyframes')) {
      return null;
    }
    if (at.name === 'media') {
      queries.unshift(at.params);
    }
  }
  return queries.join(' and ');
}

const declarationsOf = (rule: Rule): Record<string, string> => {
  const found: Record<string, string> = {};
  rule.each((node) => {
    if (node.type === 'decl') {
      found[node.prop] = node.value;
    }
  });
  return found;
};

const escaped = (name: string) => name.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');

const ownPattern = (name: string) => new RegExp(`^(?::global\\()?\\.${escaped(name)}\\)?(${PSEUDO.source})$`);

function ruleSites(rule: Rule, block: Block, file: string, scope: ClassScope, media: string): SheetRule[] {
  const declarations = declarationsOf(rule);
  const line = rule.source!.start!.line + block.line - FIRST_LINE;
  return rule.selectors.flatMap((raw) =>
    [...raw.matchAll(CLASS_NAME)].map((m) => {
      const selector = raw.trim();
      const found = raw.includes('&') ? null : selector.match(ownPattern(m[1]));
      return { name: m[1], file, line, selector, state: found?.[1] ?? '', media, declarations, own: found !== null, scope: insideGlobal(raw, m.index!) ? ClassScope.Global : scope };
    })
  );
}

export function rulesOf(file: string, text: string): SheetRule[] {
  const kind = STYLE_KINDS[extOf(file)];
  if (!kind) {
    return [];
  }
  return kind.blocks(text).flatMap((block) => {
    try {
      const found: SheetRule[] = [];
      const scope = kind.scope(file, block.open);
      postcss.parse(block.css).walkRules((rule) => {
        const media = mediaOf(rule);
        if (media !== null) {
          found.push(...ruleSites(rule, block, file, scope, media));
        }
      });
      return found;
    } catch {
      return [];
    }
  });
}
