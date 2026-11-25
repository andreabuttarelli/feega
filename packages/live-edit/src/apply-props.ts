import type { LiveAt } from './class-patch';
import type { FileChange, ReadFile } from './files';
import { loopsAt } from './loop-array';
import { attributesOf, insertAttribute, removeAttribute, type Attribute } from './open-tag';
import { attributeFor, isCallback, spreads, syntaxOf, type Json, type Syntax } from './prop-syntax';
import { locateUsage, type Which } from './usage-tag';

export type PropsAsk = { component: string; usage: LiveAt; which?: Which; set: Record<string, Json>; remove: string[] };

export type Applied = { ok: true; change: FileChange; cautions: string[]; skipped: string[] } | { ok: false; reason: string };

const NOT_WRITABLE = new Set(['children']);
const LOOP_CAUTION = 'the usage is rendered in a loop: every iteration shares it';
const SPREAD_CAUTION = 'the usage spreads props, which can override these';

const bound = (syntax: Syntax, attributes: Attribute[], prop: string) => attributes.filter((attribute) => syntax.bindings(prop).includes(attribute.name));

const replaced = (text: string, attribute: Attribute, fragment: string) => text.slice(0, attribute.start) + fragment + text.slice(attribute.end);

function written(text: string, start: number, syntax: Syntax, prop: string, fragment: string | null): { text: string; replacedExpression: boolean } {
  const [first, ...rest] = bound(syntax, attributesOf(text, start), prop);
  const expression = [first, ...rest].some((attribute) => attribute && syntax.expressionIn(attribute));
  const withoutRest = rest.reduceRight(removeAttribute, text);
  const open = attributesOf(withoutRest, start);
  const head = bound(syntax, open, prop)[0];
  if (fragment === null) {
    return { text: head ? removeAttribute(withoutRest, head) : withoutRest, replacedExpression: expression };
  }
  return { text: head ? replaced(withoutRest, head, fragment) : insertAttribute(withoutRest, start, fragment), replacedExpression: expression };
}

export async function applyProps(read: ReadFile, ask: PropsAsk): Promise<Applied> {
  const syntax = syntaxOf(ask.usage.file);
  if (!syntax) {
    return { ok: false, reason: `${ask.usage.file}: apply to page works on React, Svelte, Vue and Astro files` };
  }

  const located = await locateUsage(read, ask.component, ask.usage, ask.which);
  if (!located.ok) {
    return located;
  }

  const { page, hidden, tagAt } = located.found;
  const cautions: string[] = [];
  const skipped: string[] = [];
  const plan = [...Object.entries(ask.set).map(([prop, value]) => ({ prop, value })), ...ask.remove.map((prop) => ({ prop, value: undefined }))];
  let text = page;

  if (loopsAt(hidden, tagAt).length) {
    cautions.push(LOOP_CAUTION);
  }
  if (attributesOf(page, tagAt).some(spreads)) {
    cautions.push(SPREAD_CAUTION);
  }

  for (const { prop, value } of plan) {
    if (NOT_WRITABLE.has(prop) || isCallback(value)) {
      skipped.push(prop);
      continue;
    }
    const fragment = value === undefined ? null : attributeFor(syntax, prop, value);
    if (value !== undefined && fragment === null) {
      skipped.push(prop);
      continue;
    }
    const next = written(text, tagAt, syntax, prop, fragment);
    next.replacedExpression && cautions.push(`${prop} comes from an expression and would be replaced`);
    text = next.text;
  }

  return { ok: true, change: { path: ask.usage.file, before: page, after: text }, cautions, skipped };
}
