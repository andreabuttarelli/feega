import { offsetOf, type LiveAt } from './class-patch';
import { dataSource, stringLiteral } from './data-source';
import type { FileChange, ReadFile } from './files';
import { loopLiteral } from './loop-field';
import { Delimiter, attributesOf, insertAttribute, removeAttribute, tagNameAt, type Attribute } from './open-tag';

export enum Opens {
  NewTab = 'new-tab',
  SameTab = 'same-tab'
}

export type LinkEdit = { href: string } | { opens: Opens };

export type LinkRead = { tag: string; attr: string; value: string | null; editable: boolean; reason?: string; at?: LiveAt; newTab: boolean; tabEditable: boolean };

export type LinkWritten = { ok: true; changes: FileChange[] } | { ok: false; reason: string; at?: LiveAt };

const LINK_TAGS = new Set(['a', 'Link', 'NextLink', 'NavLink', 'NuxtLink', 'RouterLink', 'router-link', 'nuxt-link']);
const ROUTER_TAGS = new Set(['NavLink', 'NuxtLink', 'RouterLink', 'router-link', 'nuxt-link']);
const REACT_ROUTER = /from\s*['"]react-router(?:-dom)?['"]/;
const DESTINATIONS = ['href', 'to'];
const BOUND_PREFIX = /^(?::|v-bind:)/;
const QUOTED_STRING = /^(['"`])((?:\\.|(?!\1)[^\\])*)\1$/;
const PLAIN_NAME = /^[A-Za-z_$][\w$]*$/;
const NEW_TAB = '_blank';
const SAFE_REL = ['noopener', 'noreferrer'];
const SVELTE_FILE = /\.svelte$/;

enum Escaping {
  Attribute = 'attribute',
  Script = 'script'
}

type Spot = { path: string; text: string; start: number; end: number; value: string; quote: string; outer: string; escaping: Escaping };

type Resolved = { spot: Spot } | { absent: true } | { refused: string; at?: LiveAt };

export const isLinkTag = (tag: string) => LINK_TAGS.has(tag);

const canonical = (name: string) => name.replace(BOUND_PREFIX, '');

function defaultAttr(tag: string, text: string): string {
  if (ROUTER_TAGS.has(tag)) {
    return 'to';
  }
  return tag === 'Link' && REACT_ROUTER.test(text) ? 'to' : 'href';
}

function stringSpot(path: string, text: string, from: number, expression: string, outer: string): Spot | null {
  const found = expression.trim().match(QUOTED_STRING);
  if (!found || (found[1] === '`' && found[2].includes('${'))) {
    return null;
  }
  const start = from + expression.indexOf(found[0]) + 1;
  return { path, text, start, end: start + found[2].length, value: found[2], quote: found[1], outer, escaping: Escaping.Script };
}

async function constantSpot(read: ReadFile, file: string, text: string, name: string, outer: string): Promise<Resolved> {
  const literal = await stringLiteral(read, file, text, `{${name}}`);
  if (literal) {
    return { spot: { ...literal, outer, escaping: Escaping.Script } };
  }
  const data = await dataSource(read, file, text, `{${name}}`);
  return { refused: `The link comes from \`${name}\`, which is not a plain string.`, at: data?.at };
}

async function destinationOf(read: ReadFile, at: LiveAt, text: string, attribute: Attribute, instance?: number): Promise<Resolved> {
  const file = at.file;
  const bound = BOUND_PREFIX.test(attribute.name);
  const raw = attribute.value ?? '';
  const quoted = attribute.delimiter === Delimiter.Double || attribute.delimiter === Delimiter.Single;
  if (quoted && !bound) {
    if (SVELTE_FILE.test(file) && /[{}]/.test(raw)) {
      return { refused: 'The link is built from an expression, not a plain string.' };
    }
    return { spot: { path: file, text, start: attribute.valueStart, end: attribute.valueEnd, value: raw, quote: attribute.delimiter, outer: '', escaping: Escaping.Attribute } };
  }
  if (attribute.delimiter === Delimiter.Shorthand) {
    return constantSpot(read, file, text, attribute.name, '');
  }
  const outer = quoted ? attribute.delimiter : '';
  if (quoted || attribute.delimiter === Delimiter.Brace) {
    const spot = stringSpot(file, text, attribute.valueStart, raw, outer);
    if (spot) {
      return { spot };
    }
    const looped = await loopLiteral(read, at, instance, raw);
    if (looped) {
      return 'reason' in looped ? { refused: looped.reason, at: looped.at } : { spot: { ...looped, outer: '', escaping: Escaping.Script } };
    }
    return PLAIN_NAME.test(raw.trim()) ? constantSpot(read, file, text, raw.trim(), outer) : { refused: `The link comes from \`${raw.trim()}\`, not a plain string.` };
  }
  return { refused: 'The link is not a quoted string.' };
}

type Element = { text: string; start: number; tag: string; attributes: Attribute[] };

async function elementAt(read: ReadFile, at: LiveAt): Promise<Element | null> {
  const text = await read(at.file);
  const start = text === null ? -1 : offsetOf(text, at);
  const tag = text === null || start < 0 || text[start] !== '<' ? null : tagNameAt(text, start);
  return text !== null && tag ? { text, start, tag, attributes: attributesOf(text, start) } : null;
}

const named = (attributes: Attribute[], name: string) => attributes.find((a) => a.name === name);

function literalOf(attribute: Attribute | undefined): string | null | undefined {
  if (!attribute) {
    return undefined;
  }
  if (attribute.delimiter === Delimiter.Double || attribute.delimiter === Delimiter.Single) {
    return attribute.value;
  }
  return attribute.delimiter === Delimiter.Brace ? (attribute.value?.trim().match(QUOTED_STRING)?.[2] ?? null) : null;
}

async function resolved(read: ReadFile, at: LiveAt, element: Element, instance?: number): Promise<{ attr: string; resolved: Resolved }> {
  const present = element.attributes.find((a) => DESTINATIONS.includes(canonical(a.name)));
  if (!present) {
    return { attr: defaultAttr(element.tag, element.text), resolved: { absent: true } };
  }
  return { attr: canonical(present.name), resolved: await destinationOf(read, at, element.text, present, instance) };
}

export async function linkOf(read: ReadFile, at: LiveAt, instance?: number): Promise<LinkRead | null> {
  const element = await elementAt(read, at);
  if (!element || !isLinkTag(element.tag)) {
    return null;
  }
  const { attr, resolved: found } = await resolved(read, at, element, instance);
  const target = literalOf(named(element.attributes, 'target'));
  const base = { tag: element.tag, attr, newTab: target === NEW_TAB, tabEditable: target !== null };
  if ('spot' in found) {
    return { ...base, value: found.spot.value, editable: true };
  }
  if ('absent' in found) {
    return { ...base, value: '', editable: true };
  }
  return { ...base, value: null, editable: false, reason: found.refused, at: found.at };
}

function spotChange(spot: Spot, value: string): FileChange | null {
  const broken = /[\r\n]/.test(value) || (spot.outer !== '' && value.includes(spot.outer)) || (SVELTE_FILE.test(spot.path) && spot.escaping === Escaping.Attribute && /[{}]/.test(value));
  if (broken || (spot.escaping === Escaping.Attribute && value.includes(spot.quote))) {
    return null;
  }
  const written = spot.escaping === Escaping.Attribute ? value : value.replace(/\\/g, '\\\\').split(spot.quote).join(`\\${spot.quote}`);
  return { path: spot.path, before: spot.text, after: spot.text.slice(0, spot.start) + written + spot.text.slice(spot.end) };
}

const REFUSED_VALUE = 'The address has characters that would break the source: not written.';

async function hrefWritten(read: ReadFile, at: LiveAt, element: Element, href: string, instance?: number): Promise<LinkWritten> {
  const { attr, resolved: found } = await resolved(read, at, element, instance);
  if ('refused' in found) {
    return { ok: false, reason: found.refused, at: found.at };
  }
  if ('absent' in found) {
    if (/["\r\n]/.test(href)) {
      return { ok: false, reason: REFUSED_VALUE };
    }
    return { ok: true, changes: [{ path: at.file, before: element.text, after: insertAttribute(element.text, element.start, `${attr}="${href}"`) }] };
  }
  const change = spotChange(found.spot, href);
  if (!change) {
    return { ok: false, reason: REFUSED_VALUE };
  }
  return { ok: true, changes: change.before === change.after ? [] : [change] };
}

export function withAttribute(text: string, start: number, name: string, value: string | null): string {
  const found = attributesOf(text, start).find((a) => a.name === name);
  if (!found) {
    return value === null ? text : insertAttribute(text, start, `${name}="${value}"`);
  }
  if (value === null) {
    return removeAttribute(text, found);
  }
  if (found.delimiter === Delimiter.Brace) {
    return text.slice(0, found.start) + `${name}="${value}"` + text.slice(found.end);
  }
  return text.slice(0, found.valueStart) + value + text.slice(found.valueEnd);
}

function relWith(text: string, start: number, opens: Opens): string {
  const tokens = (literalOf(named(attributesOf(text, start), 'rel')) ?? '').split(/\s+/).filter(Boolean);
  if (opens === Opens.NewTab) {
    const merged = [...tokens, ...SAFE_REL.filter((t) => !tokens.includes(t))];
    return withAttribute(text, start, 'rel', merged.join(' '));
  }
  const kept = tokens.filter((t) => !SAFE_REL.includes(t));
  return withAttribute(text, start, 'rel', kept.length ? kept.join(' ') : null);
}

function opensWritten(element: Element, at: LiveAt, opens: Opens): LinkWritten {
  const current = literalOf(named(element.attributes, 'target'));
  const rel = literalOf(named(element.attributes, 'rel'));
  if (current === null || rel === null) {
    return { ok: false, reason: 'The target or rel is not a plain string: not written.' };
  }
  const { text, start } = element;
  const targeted = opens === Opens.NewTab ? withAttribute(text, start, 'target', NEW_TAB) : current === NEW_TAB ? withAttribute(text, start, 'target', null) : text;
  const after = relWith(targeted, start, opens);
  return { ok: true, changes: after === text ? [] : [{ path: at.file, before: text, after }] };
}

export async function linkWrite(read: ReadFile, at: LiveAt, edit: LinkEdit, instance?: number): Promise<LinkWritten> {
  const element = await elementAt(read, at);
  if (!element || !isLinkTag(element.tag)) {
    return { ok: false, reason: `${at.file}:${at.line}: this element is not a link` };
  }
  return 'href' in edit ? hrefWritten(read, at, element, edit.href, instance) : opensWritten(element, at, edit.opens);
}
