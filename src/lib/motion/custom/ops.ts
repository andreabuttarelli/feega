import { CUSTOM_NAME } from '../components';
import { clipsOf, parseMotionDoc, type MotionDoc } from '../doc';
import type { OpResult } from '../timeline';
import { lintReport, lintSource } from './lint';
import { extractParams } from './params';
import { parseComponent, type ComponentCheck, type CustomSource, type PropsSchema, type SourceFile } from './component';

export type ComponentDraft = { source: CustomSource; propsSchema: PropsSchema };
export type SourceEdit = { file: SourceFile; find: string; replace: string };

const fail = (error: string): OpResult => ({ ok: false, error });

function settled(doc: MotionDoc): OpResult {
  const verdict = parseMotionDoc(doc);
  return verdict.ok ? { ok: true, doc: verdict.doc } : fail(verdict.error);
}

export function writeComponent(doc: MotionDoc, name: string, draft: ComponentDraft): OpResult {
  if (!CUSTOM_NAME.test(name)) {
    return fail(`component names are PascalCase letters and digits, e.g. NodeGraph (got "${name}")`);
  }
  const problems = lintSource(draft.source);
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

function occurrences(text: string, find: string): number {
  return find ? text.split(find).length - 1 : 0;
}

export function patchComponent(doc: MotionDoc, name: string, edits: SourceEdit[]): OpResult {
  const component = doc.components[name];
  if (!component) {
    return fail(`no custom component ${name}`);
  }
  const source = { ...component.source };
  for (const edit of edits) {
    const count = occurrences(source[edit.file], edit.find);
    if (count !== 1) {
      return fail(`${edit.file}: the text to replace must occur exactly once, it occurs ${count} times: ${JSON.stringify(edit.find.slice(0, 80))}`);
    }
    source[edit.file] = source[edit.file].replace(edit.find, () => edit.replace);
  }
  return writeComponent(doc, name, { source, propsSchema: component.propsSchema });
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
