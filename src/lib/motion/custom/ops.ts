import { CUSTOM_NAME } from '@feega/motion-core/motion/components';
import { clipsOf, parseMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import type { OpResult } from '@feega/motion-core/motion/timeline';
import { lintReport, lintSource } from './lint';
import { extractParams } from '@feega/motion-core/motion/custom/params';
import { ComponentMode, MAX_SOURCE_TOTAL, SOURCE_FILES, parseComponent, type ComponentCheck, type CustomSource, type PropsSchema, type SourceFile } from '@feega/motion-core/motion/custom/component';

export type ComponentDraft = { source: CustomSource; propsSchema: PropsSchema; mode?: ComponentMode };

const fail = (error: string): OpResult => ({ ok: false, error });

function settled(doc: MotionDoc): OpResult {
  const verdict = parseMotionDoc(doc);
  return verdict.ok ? { ok: true, doc: verdict.doc } : fail(verdict.error);
}

export function writeComponent(doc: MotionDoc, name: string, draft: ComponentDraft): OpResult {
  if (!CUSTOM_NAME.test(name)) {
    return fail(`component names are PascalCase letters and digits, e.g. NodeGraph (got "${name}")`);
  }
  const problems = lintSource(draft.source, draft.mode);
  if (problems.length) {
    return fail(`the code breaks the authoring contract:\n${lintReport(problems)}`);
  }
  let declared: ReturnType<typeof extractParams>;
  try {
    declared = extractParams(draft.source.js);
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
  const propsSchema = { type: 'object' as const, properties: { ...draft.propsSchema.properties, ...declared } };
  const previous = doc.components[name];
  const parsed = parseComponent({ ...draft, propsSchema, version: (previous?.version ?? 0) + 1, check: null });
  if (!parsed.ok) {
    return fail(parsed.error);
  }
  const components = { ...doc.components, [name]: parsed.component };
  const total = sourceTotal(components);
  if (total > MAX_SOURCE_TOTAL) {
    return fail(`components hold ${total} chars of code, over ${MAX_SOURCE_TOTAL} for the whole video: shorten one or remove one no clip uses`);
  }
  return settled({ ...doc, components });
}

const sourceTotal = (components: MotionDoc['components']) => Object.values(components).reduce((sum, c) => sum + c.source.html.length + c.source.css.length + c.source.js.length, 0);

export enum Occurrence {
  First = 'first',
  Last = 'last',
  All = 'all'
}

export type FindEdit = { file: SourceFile; find: string; replace: string; occurrence?: Occurrence };
export type RangeEdit = { file: SourceFile; lines: [number, number]; text?: string };
export type InsertEdit = { file: SourceFile; after_line: number; text: string };
export type SourceEdit = FindEdit | RangeEdit | InsertEdit;
export type EditDiff = { file: SourceFile; replaced: number; before: string; after: string };
export type UpdateResult = { ok: true; doc: MotionDoc; diff: EditDiff[] } | { ok: false; error: string };

const DIFF_CHARS = 600;

function occurrences(text: string, find: string): number {
  return find ? text.split(find).length - 1 : 0;
}

function linesAround(text: string, at: number, length: number): string {
  const start = text.lastIndexOf('\n', at - 1) + 1;
  const end = text.indexOf('\n', at + length);
  return text.slice(start, end === -1 ? text.length : end).trim().slice(0, DIFF_CHARS);
}

function replaced(text: string, edit: FindEdit): string {
  if (edit.occurrence === Occurrence.All) {
    return text.split(edit.find).join(edit.replace);
  }
  const at = edit.occurrence === Occurrence.Last ? text.lastIndexOf(edit.find) : text.indexOf(edit.find);
  return text.slice(0, at) + edit.replace + text.slice(at + edit.find.length);
}

type Applied = { ok: true; text: string; diff: EditDiff } | { ok: false; error: string };

function findEdit(text: string, edit: FindEdit): Applied {
  const count = occurrences(text, edit.find);
  const quoted = JSON.stringify(edit.find.slice(0, 80));
  if (count === 0) {
    return { ok: false, error: `${edit.file}: the text to replace is not there: ${quoted}` };
  }
  if (count > 1 && !edit.occurrence) {
    return { ok: false, error: `${edit.file}: the text to replace occurs ${count} times, name occurrence first, last or all, or widen it: ${quoted}` };
  }
  const at = edit.occurrence === Occurrence.Last ? text.lastIndexOf(edit.find) : text.indexOf(edit.find);
  const next = replaced(text, edit);
  return { ok: true, text: next, diff: { file: edit.file, replaced: edit.occurrence === Occurrence.All ? count : 1, before: linesAround(text, at, edit.find.length), after: linesAround(next, at, edit.replace.length) } };
}

function spliceLines(file: SourceFile, text: string, start: number, removed: number, added: string | undefined): Applied {
  const lines = text.split('\n');
  const inserted = added === undefined ? [] : added.split('\n');
  const before = lines.splice(start, removed, ...inserted);
  return { ok: true, text: lines.join('\n'), diff: { file, replaced: removed, before: before.join('\n').slice(0, DIFF_CHARS), after: inserted.join('\n').slice(0, DIFF_CHARS) } };
}

const lineCount = (text: string) => text.split('\n').length;

function rangeEdit(text: string, edit: RangeEdit): Applied {
  const [from, to] = edit.lines;
  const total = lineCount(text);
  if (from < 1 || to < from || to > total) {
    return { ok: false, error: `${edit.file} has ${total} lines: lines ${from}..${to} is not a range in it` };
  }
  return spliceLines(edit.file, text, from - 1, to - from + 1, edit.text);
}

function insertEdit(text: string, edit: InsertEdit): Applied {
  const total = lineCount(text);
  if (edit.after_line < 0 || edit.after_line > total) {
    return { ok: false, error: `${edit.file} has ${total} lines: cannot insert after line ${edit.after_line}` };
  }
  return spliceLines(edit.file, text, edit.after_line, 0, edit.text);
}

function applyEdit(text: string, edit: SourceEdit): Applied {
  if ('find' in edit) {
    return findEdit(text, edit);
  }
  return 'lines' in edit ? rangeEdit(text, edit) : insertEdit(text, edit);
}

export const READ_LINES = 400;
const MAX_MATCHES = 100;

export type ReadAsk = { file?: SourceFile; offset?: number; limit?: number; pattern?: string };
export type SourceMatch = { file: SourceFile; line: number; text: string };
export type SourceRead = { file: SourceFile; total_lines: number; from: number; to: number; more: boolean; text: string; matches?: undefined } | { matches: SourceMatch[]; truncated: boolean; file?: undefined; text?: undefined };

function searchSource(source: CustomSource, files: readonly SourceFile[], pattern: string): SourceRead {
  const re = new RegExp(pattern);
  const matches = files.flatMap((file) => source[file].split('\n').flatMap((text, i) => (re.test(text) ? [{ file, line: i + 1, text: text.slice(0, DIFF_CHARS) }] : [])));
  return { matches: matches.slice(0, MAX_MATCHES), truncated: matches.length > MAX_MATCHES };
}

export function readSource(source: CustomSource, ask: ReadAsk): SourceRead {
  if (ask.pattern) {
    return searchSource(source, ask.file ? [ask.file] : SOURCE_FILES, ask.pattern);
  }
  const file = ask.file ?? 'js';
  const lines = source[file].split('\n');
  const from = Math.max(1, ask.offset ?? 1);
  const to = Math.min(lines.length, from + (ask.limit ?? READ_LINES) - 1);
  const text = lines.slice(from - 1, to).map((line, i) => `${from + i}\t${line}`).join('\n');
  return { file, total_lines: lines.length, from, to, more: to < lines.length, text };
}

export function updateComponent(doc: MotionDoc, name: string, edits: SourceEdit[]): UpdateResult {
  const component = doc.components[name];
  if (!component) {
    return { ok: false, error: `no custom component ${name}` };
  }
  const source = { ...component.source };
  const diff: EditDiff[] = [];
  for (const edit of edits) {
    const applied = applyEdit(source[edit.file], edit);
    if (!applied.ok) {
      return applied;
    }
    source[edit.file] = applied.text;
    diff.push(applied.diff);
  }
  const written = writeComponent(doc, name, { source, propsSchema: component.propsSchema, mode: component.mode });
  return written.ok ? { ...written, diff } : written;
}

export function removeComponent(doc: MotionDoc, name: string): OpResult {
  const users = clipsOf(doc).filter((c) => c.component === 'Custom' && c.props.name === name);
  if (users.length) {
    return fail(`${name} is used by clips ${users.map((c) => c.id).join(', ')}: remove them first`);
  }
  const { [name]: _removed, ...rest } = doc.components;
  return { ok: true, doc: { ...doc, components: rest } };
}

export function recordCheck(doc: MotionDoc, name: string, check: ComponentCheck): OpResult {
  const component = doc.components[name];
  if (!component) {
    return fail(`no custom component ${name}`);
  }
  return { ok: true, doc: { ...doc, components: { ...doc.components, [name]: { ...component, check } } } };
}
