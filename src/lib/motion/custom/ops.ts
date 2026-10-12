import { CUSTOM_NAME } from '../components';
import { clipsOf, parseMotionDoc, type MotionDoc } from '../doc';
import type { OpResult } from '../timeline';
import { lintReport, lintSource } from './lint';
import { extractParams } from './params';
import { ComponentMode, parseComponent, type ComponentCheck, type CustomSource, type PropsSchema, type SourceFile } from './component';

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
  return settled({ ...doc, components: { ...doc.components, [name]: parsed.component } });
}

export enum Occurrence {
  First = 'first',
  Last = 'last',
  All = 'all'
}

export type SourceEdit = { file: SourceFile; find: string; replace: string; occurrence?: Occurrence };
export type EditDiff = { file: SourceFile; replaced: number; before: string; after: string };
export type UpdateResult = { ok: true; doc: MotionDoc; diff: EditDiff[] } | { ok: false; error: string };

const DIFF_CHARS = 160;

function occurrences(text: string, find: string): number {
  return find ? text.split(find).length - 1 : 0;
}

function lineAround(text: string, at: number): string {
  const start = text.lastIndexOf('\n', at - 1) + 1;
  const end = text.indexOf('\n', at);
  return text.slice(start, end === -1 ? text.length : end).trim().slice(0, DIFF_CHARS);
}

function replaced(text: string, edit: SourceEdit): string {
  if (edit.occurrence === Occurrence.All) {
    return text.split(edit.find).join(edit.replace);
  }
  const at = edit.occurrence === Occurrence.Last ? text.lastIndexOf(edit.find) : text.indexOf(edit.find);
  return text.slice(0, at) + edit.replace + text.slice(at + edit.find.length);
}

export function updateComponent(doc: MotionDoc, name: string, edits: SourceEdit[]): UpdateResult {
  const component = doc.components[name];
  if (!component) {
    return { ok: false, error: `no custom component ${name}` };
  }
  const source = { ...component.source };
  const diff: EditDiff[] = [];
  for (const edit of edits) {
    const text = source[edit.file];
    const count = occurrences(text, edit.find);
    const quoted = JSON.stringify(edit.find.slice(0, 80));
    if (count === 0) {
      return { ok: false, error: `${edit.file}: the text to replace is not there: ${quoted}` };
    }
    if (count > 1 && !edit.occurrence) {
      return { ok: false, error: `${edit.file}: the text to replace occurs ${count} times, name occurrence first, last or all, or widen it: ${quoted}` };
    }
    const at = edit.occurrence === Occurrence.Last ? text.lastIndexOf(edit.find) : text.indexOf(edit.find);
    source[edit.file] = replaced(text, edit);
    diff.push({ file: edit.file, replaced: edit.occurrence === Occurrence.All ? count : 1, before: lineAround(text, at), after: lineAround(source[edit.file], at) });
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
