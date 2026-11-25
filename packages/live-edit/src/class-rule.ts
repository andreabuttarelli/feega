import { pseudoOf, ElementState } from './element-state';
import type { FileChange, ReadFile } from './files';
import { hasRule, ruleInBody } from './scoped-rule';
import type { Css } from './style-attr';

export type ClassTarget = { name: string; file: string };

export type ClassWritten = { ok: true; changes: FileChange[] } | { ok: false; reason: string };

type Home = { within: (within: string) => string; indent: string; block: boolean };

const STYLE_BLOCK = /(<style[^>]*>)([\s\S]*?)(<\/style>)/g;
const RULE_INDENT = '  ';
const NO_INDENT = '';

const asWritten = (within: string) => within;
const globally = (within: string) => `:global(${within})`;

const HOMES: Record<string, Home> = {
  css: { within: asWritten, indent: NO_INDENT, block: false },
  module: { within: globally, indent: NO_INDENT, block: false },
  html: { within: asWritten, indent: RULE_INDENT, block: true },
  vue: { within: asWritten, indent: RULE_INDENT, block: true },
  svelte: { within: globally, indent: RULE_INDENT, block: true },
  astro: { within: asWritten, indent: RULE_INDENT, block: true }
};

const homeOf = (file: string): Home | undefined => HOMES[file.endsWith('.module.css') ? 'module' : file.slice(file.lastIndexOf('.') + 1)];

function inBlock(text: string, name: string, edit: (body: string) => string): string | null {
  const blocks = [...text.matchAll(STYLE_BLOCK)];
  const block = blocks.find((m) => hasRule(m[2], `.${name}`)) ?? blocks[0];
  if (!block) {
    return null;
  }
  const start = block.index! + block[1].length;
  return text.slice(0, start) + edit(block[2]) + text.slice(start + block[2].length);
}

export async function classRule(read: ReadFile, target: ClassTarget, css: Css, viewport?: number, state = ElementState.Default, media?: string | null, within?: string | null): Promise<ClassWritten> {
  const home = homeOf(target.file);
  const before = await read(target.file);
  if (!home || before === null) {
    return { ok: false, reason: `${target.file}: no stylesheet to write .${target.name} into` };
  }

  const rule = (body: string) => ruleInBody(body, `${target.name}${pseudoOf(state)}`, new Map(Object.entries(css)), viewport, home.indent, media, within ? home.within(within) : null);
  const after = home.block ? inBlock(before, target.name, rule) : rule(before);
  if (after === null) {
    return { ok: false, reason: `${target.file}: no <style> block to write .${target.name} into` };
  }

  return { ok: true, changes: [{ path: target.file, before, after }] };
}
