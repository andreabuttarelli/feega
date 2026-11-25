import { offsetOf, openTagEnd } from '@feega/live-edit/class-patch';
import { inside, liveAtOf, reader } from '@feega/live-edit/live-ask';
import { Scope } from '@feega/live-edit/scoped-rule';
import { ImpactKind, type ClassInfo, type Impact, type ImpactAsk, type UsageSite } from '../messages';
import { isEntry, isPage } from './entry-files';
import type { UsageIndex } from './usages';

export { ImpactKind, type Impact, type ImpactAsk };

export type Probe = (ask: ImpactAsk) => Promise<string[] | null>;

type Facts = { file: string; open: string | null; ask: ImpactAsk; writes: string[] | null };

const LITERAL_CLASS = /\s(?:class|className)=(?:"[^"{}]*"|\{\s*(?:"[^"]*"|'[^']*'|\w+\.\w+|\w+\[['"][^'"]+['"]\])\s*\})/g;
const COMPUTED_CLASS = /\s(?::class|v-bind:class|class:[\w-]+|(?:class|className)=(?:\{|"[^"]*\{|'[^']*\{))|\{\s*\.\.\./;
const CSS_VARIABLE = /^\s*var\(\s*--/;
const MODULE_SHEET = /\.module\.css$/;
const SHEET = /\.css$/;
const COMPONENT_TAG = /^<(?:[A-Z]|\w+\.)/;
const PASCAL_BREAK = /[-_.\s]+(\w)/g;

export const classOpen = (open: string): boolean => COMPUTED_CLASS.test(open.replace(LITERAL_CLASS, ''));

export const UNKNOWN_CAUSES: { reason: string; hits: (facts: Facts) => boolean }[] = [
  { reason: 'the element is not where the page says', hits: (f) => f.open === null },
  { reason: 'the rule lands in a global stylesheet', hits: (f) => f.ask.page !== undefined || Boolean(f.writes?.some((path) => SHEET.test(path) && !MODULE_SHEET.test(path))) },
  { reason: 'a CSS variable can reach other elements', hits: (f) => CSS_VARIABLE.test(f.ask.value ?? '') },
  { reason: 'the class comes from props or a function', hits: (f) => f.open !== null && classOpen(f.open) }
];

export function nameOf(file: string): string {
  const parts = file.replace(/\.[^./]+$/, '').split('/');
  const last = parts.pop()!.replace(/^\+/, '');
  const base = last === 'index' ? (parts.pop() ?? last) : last;
  const camel = base.replace(PASCAL_BREAK, (_, c: string) => c.toUpperCase());
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

const ownInstance = ({ file, open, ask, writes }: Facts) => ask.scope === Scope.Element && open !== null && COMPONENT_TAG.test(open) && Boolean(writes?.length) && writes!.every((path) => path === file);

async function openTagOf(root: string, file: string, ask: ImpactAsk): Promise<string | null> {
  const at = liveAtOf(ask.at);
  const text = at && inside(root, at.file) ? await reader(root)(at.file) : null;
  const start = text === null || !at ? -1 : offsetOf(text, at);
  const end = start < 0 || text![start] !== '<' ? -1 : openTagEnd(text!, start);
  return end < 0 ? null : text!.slice(start, end + 1);
}

export async function impactOf(root: string, ask: ImpactAsk, probe: Probe, index: UsageIndex): Promise<Impact> {
  const at = liveAtOf(ask.at);
  if (!at) {
    return { kind: ImpactKind.Unknown, reason: UNKNOWN_CAUSES[0].reason };
  }
  const open = await openTagOf(root, at.file, ask);
  const facts: Facts = { file: at.file, open, ask, writes: open === null ? null : await probe(ask) };
  const cause = UNKNOWN_CAUSES.find((c) => c.hits(facts));
  if (cause) {
    return { kind: ImpactKind.Unknown, reason: cause.reason };
  }
  if (isPage(at.file) || ownInstance(facts)) {
    return { kind: ImpactKind.Local };
  }
  const files = (await index.usersOf(at.file)).filter((site) => !isEntry(site.file));
  return files.length ? { kind: ImpactKind.Component, name: nameOf(at.file), files } : { kind: ImpactKind.Local };
}

const firstUsePerFile = (info: ClassInfo): UsageSite[] => info.uses.filter((u, i) => info.uses.findIndex((o) => o.file === u.file) === i).map(({ file, line }) => ({ file, line }));

export const classImpactOf = (info: ClassInfo | undefined): Impact =>
  info ? { kind: ImpactKind.Class, name: info.name, elements: info.elements, files: firstUsePerFile(info) } : { kind: ImpactKind.Unknown, reason: 'the class is not in the project index' };

const HOLD_REASON: { [K in ImpactKind]: (impact: Extract<Impact, { kind: K }>) => string | null } = {
  [ImpactKind.Local]: () => null,
  [ImpactKind.Component]: () => null,
  [ImpactKind.Class]: (impact) => (impact.elements > 1 ? `.${impact.name} is used in ${impact.elements} elements, ${impact.files.length} files` : null),
  [ImpactKind.Unknown]: (impact) => impact.reason
};

export const holdReason = (impact: Impact): string | null => (HOLD_REASON[impact.kind] as (impact: Impact) => string | null)(impact);
