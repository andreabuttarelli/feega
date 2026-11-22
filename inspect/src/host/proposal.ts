import { addDependency } from '@feega/live-edit/add-dependency';
import { addImport, importLine, relativeImport } from '@feega/live-edit/add-import';
import { AddPlace, addMarkup } from '@feega/live-edit/add-node';
import type { LiveAt } from '@feega/live-edit/class-patch';
import type { FileChange, ReadFile } from '@feega/live-edit/files';
import { inside, liveAtOf } from '@feega/live-edit/live-ask';
import { setAttributes } from '@feega/live-edit/set-attributes';
import type { Css } from '@feega/live-edit/style-attr';
import { OpKind, Place, type ComponentFile, type Op, type SupportFile } from '@feega/plugin-api/protocol';

export type Changes = { ok: true; changes: FileChange[] } | { ok: false; reason: string; at?: LiveAt };

export type ProposalDeps = { root: string; read: ReadFile; files: () => Promise<string[]>; appDir: string; style: (read: ReadFile, at: LiveAt, css: Css) => Promise<Changes> };

type Handler<K extends OpKind> = (deps: ProposalDeps, op: Extract<Op, { kind: K }>) => Promise<Changes>;

const PACKAGE_FILE = 'package.json';
const BINARY = 'base64';

const ORDER: OpKind[] = [OpKind.Style, OpKind.Attributes, OpKind.Dependency, OpKind.Asset, OpKind.Insert];

const PLACES: Record<Place, AddPlace> = { [Place.Auto]: AddPlace.Auto, [Place.Child]: AddPlace.Child, [Place.After]: AddPlace.After, [Place.Before]: AddPlace.Before };

const refused = (reason: string): Changes => ({ ok: false, reason });

const appPath = (deps: ProposalDeps, file: string) => (deps.appDir ? `${deps.appDir}/${file}` : file);

function located(deps: ProposalDeps, raw: string): LiveAt | string {
  const at = liveAtOf(raw);
  return at && inside(deps.root, at.file) ? at : `${raw} is not a file:line:col inside the workspace`;
}

async function created(deps: ProposalDeps, file: ComponentFile | SupportFile): Promise<FileChange[]> {
  const path = appPath(deps, file.file);
  return (await deps.read(path)) === null ? [{ path, before: '', after: file.source }] : [];
}

const style: Handler<OpKind.Style> = async (deps, op) => {
  const at = located(deps, op.at);
  return typeof at === 'string' ? refused(at) : deps.style(deps.read, at, op.css);
};

const COMPONENT_FILE = /\.(?:svelte|vue|astro|tsx|jsx)$/;

const lineColOf = (text: string, offset: number) => {
  const lines = text.slice(0, offset).split('\n');
  return { line: lines.length, col: lines[lines.length - 1].length + 1 };
};

async function usagesOf(deps: ProposalDeps, tag: string): Promise<LiveAt[]> {
  const pattern = new RegExp(`<${tag}(?=[\\s/>])`, 'g');
  const found: LiveAt[] = [];
  for (const file of (await deps.files()).filter((f) => COMPONENT_FILE.test(f) && f.startsWith(deps.appDir))) {
    const text = (await deps.read(file)) ?? '';
    for (const match of text.matchAll(pattern)) {
      found.push({ file, ...lineColOf(text, match.index) });
    }
  }
  return found;
}

const written = (out: Awaited<ReturnType<typeof setAttributes>>): Changes => (out.ok ? { ok: true, changes: [out.change] } : out);

const attributes: Handler<OpKind.Attributes> = async (deps, op) => {
  const at = op.at ? located(deps, op.at) : null;
  if (typeof at === 'string') {
    return refused(at);
  }
  const near = at ? await setAttributes(deps.read, at, op.set, op.tag) : null;
  if (near?.ok || !op.tag) {
    return near ? written(near) : refused('no element given');
  }
  const usages = await usagesOf(deps, op.tag);
  if (usages.length !== 1) {
    return refused(usages.length ? `<${op.tag}> is used in ${usages.length} places: select the one to change in its own file` : `cannot find <${op.tag}> in the project`);
  }
  return written(await setAttributes(deps.read, usages[0], op.set));
};

const dependency: Handler<OpKind.Dependency> = async (deps, op) => {
  const path = appPath(deps, PACKAGE_FILE);
  const before = await deps.read(path);
  const out = addDependency(before, op.name, op.version, op.dev);
  return out.ok ? { ok: true, changes: [{ path, before: before ?? '', after: out.after }] } : out;
};

const asset: Handler<OpKind.Asset> = async (deps, op) => {
  const path = appPath(deps, op.file);
  if (!inside(deps.root, path)) {
    return refused(`${op.file} is outside the workspace`);
  }
  return { ok: true, changes: (await deps.read(path)) === null ? [{ path, before: '', after: op.base64, encoding: BINARY }] : [] };
};

const insert: Handler<OpKind.Insert> = async (deps, op) => {
  const at = located(deps, op.at);
  if (typeof at === 'string') {
    return refused(at);
  }
  const target = appPath(deps, op.component.file);
  if (!inside(deps.root, target)) {
    return refused(`${op.component.file} is outside the workspace`);
  }
  const { name, attributes: props } = op.component;
  const placed = await addMarkup(deps.read, at, `<${name}${props ? ` ${props}` : ''} />`, PLACES[op.place]);
  if (!placed.ok) {
    return placed;
  }
  const page = placed.changes.find((change) => change.path === at.file)!;
  const imported = addImport(at.file, page.after, importLine(name, relativeImport(at.file, target)));
  if (!imported.ok) {
    return refused(imported.reason);
  }
  const files = [op.component, ...(op.support ?? [])];
  const made = (await Promise.all(files.map((file) => created(deps, file)))).flat();
  return { ok: true, changes: [{ ...page, after: imported.after }, ...made] };
};

const HANDLERS: { [K in OpKind]: Handler<K> } = {
  [OpKind.Style]: style,
  [OpKind.Attributes]: attributes,
  [OpKind.Dependency]: dependency,
  [OpKind.Asset]: asset,
  [OpKind.Insert]: insert
};

const overlaid = (read: ReadFile, changes: FileChange[]): ReadFile => async (path) => {
  const changed = changes.find((c) => c.path === path);
  return changed ? changed.after : read(path);
};

function merged(first: FileChange[], more: FileChange[]): FileChange[] {
  const updated = first.map((c) => ({ ...c, after: more.find((m) => m.path === c.path)?.after ?? c.after }));
  return [...updated, ...more.filter((m) => !first.some((c) => c.path === m.path))];
}

export async function proposalChanges(ops: Op[], deps: ProposalDeps): Promise<Changes> {
  let changes: FileChange[] = [];
  for (const kind of ORDER) {
    for (const op of ops.filter((o) => o.kind === kind)) {
      const out = await (HANDLERS[kind] as (deps: ProposalDeps, op: Op) => Promise<Changes>)({ ...deps, read: overlaid(deps.read, changes) }, op);
      if (!out.ok) {
        return out;
      }
      changes = merged(changes, out.changes);
    }
  }
  return { ok: true, changes };
}
