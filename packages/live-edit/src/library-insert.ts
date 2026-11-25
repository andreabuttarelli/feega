import { AddPlace, addMarkup, lineCol } from './add-node';
import { offsetOf, type LiveAt } from './class-patch';
import type { FileChange, ReadFile } from './files';
import { GLOBAL_SHEETS, globalSheetOf, googleFontImport, googleFontLink } from './font-wiring';
import type { Structured } from './move-into';

export enum LibFramework {
  Svelte = 'svelte',
  React = 'react',
  Vue = 'vue',
  Astro = 'astro'
}

export enum Layout {
  SvelteKit = 'sveltekit',
  Svelte = 'svelte',
  React = 'react',
  Next = 'next',
  Vue = 'vue',
  Nuxt = 'nuxt',
  Astro = 'astro'
}

export type ItemFile = { name: string; text: string };

export type InsertItem = {
  id: string;
  component: string;
  fonts: { family: string; weights: number[] }[];
  files: Record<LibFramework, ItemFile[]>;
};

type Target = {
  framework: LibFramework;
  dir: string;
  hosts: string[];
  suffix: string;
  importFrom: (file: string, path: string) => string | null;
  statement: (name: string, spec: string) => string;
  tag: (name: string) => string;
  client: boolean;
};

const TOKENS_FILE = 'tokens.css';
const TOKENS_REFERENCE = `feega/${TOKENS_FILE}`;
const SVELTE_DIR = 'src/lib/components/feega';
const SRC_DIR = 'src/components/feega';
const SHEET_IMPORT_LINES = /^(?:@charset[^\n]*\n|@import[^\n]*\n)*/;
const HOOK_CALL = /\buse[A-Z]\w*\(/;
const CLIENT_DIRECTIVE = /^\s*['"]use client['"]/;
const SUPPORTED = 'Svelte, React, Vue or Astro';
const SCRIPT_INDENT = '  ';

const ROOT_ELEMENTS: Record<string, RegExp> = {
  '.svelte': /^(<)(?!script\b|style\b)[a-z]/md,
  '.vue': /<template>\s*(<)[a-z]/d,
  '.astro': /^---[\s\S]*?^---\s*\n[\s\S]*?^(<)(?!script\b|style\b)[a-z]/md,
  '.tsx': /\breturn\s*\(?\s*(<)[a-z]/d,
  '.jsx': /\breturn\s*\(?\s*(<)[a-z]/d
};

const relative = (file: string, path: string): string => {
  const from = file.split('/').slice(0, -1);
  const to = path.split('/');
  while (from.length && to.length > 1 && from[0] === to[0]) {
    from.shift();
    to.shift();
  }
  const up = from.map(() => '..');
  return [...(up.length ? up : ['.']), ...to].join('/');
};

const defaultImport = (name: string, spec: string) => `import ${name} from '${spec}';`;

const namedImport = (name: string, spec: string) => `import { ${name} } from '${spec}';`;

const selfClosing = (name: string) => `<${name} />`;

export const TARGETS: Record<Layout, Target> = {
  [Layout.SvelteKit]: { framework: LibFramework.Svelte, dir: SVELTE_DIR, hosts: ['.svelte'], suffix: '.svelte', importFrom: (_file, path) => path.replace('src/lib/', '$lib/'), statement: defaultImport, tag: selfClosing, client: false },
  [Layout.Svelte]: { framework: LibFramework.Svelte, dir: SVELTE_DIR, hosts: ['.svelte'], suffix: '.svelte', importFrom: relative, statement: defaultImport, tag: selfClosing, client: false },
  [Layout.React]: { framework: LibFramework.React, dir: SRC_DIR, hosts: ['.tsx', '.jsx'], suffix: '', importFrom: relative, statement: namedImport, tag: selfClosing, client: false },
  [Layout.Next]: { framework: LibFramework.React, dir: SRC_DIR, hosts: ['.tsx', '.jsx'], suffix: '', importFrom: relative, statement: namedImport, tag: selfClosing, client: true },
  [Layout.Vue]: { framework: LibFramework.Vue, dir: SRC_DIR, hosts: ['.vue'], suffix: '.vue', importFrom: relative, statement: defaultImport, tag: selfClosing, client: false },
  [Layout.Nuxt]: { framework: LibFramework.Vue, dir: 'components/feega', hosts: ['.vue'], suffix: '.vue', importFrom: () => null, statement: defaultImport, tag: (name) => `<Feega${name} />`, client: false },
  [Layout.Astro]: { framework: LibFramework.Astro, dir: SRC_DIR, hosts: ['.astro'], suffix: '.astro', importFrom: relative, statement: defaultImport, tag: selfClosing, client: false }
};

const DEPENDENCY_LAYOUTS: [string, Layout][] = [
  ['astro', Layout.Astro],
  ['nuxt', Layout.Nuxt],
  ['next', Layout.Next],
  ['@sveltejs/kit', Layout.SvelteKit],
  ['svelte', Layout.Svelte],
  ['vue', Layout.Vue],
  ['react', Layout.React]
];

export function layoutOf(packageJson: string | null): Layout | null {
  try {
    const parsed = JSON.parse(packageJson ?? '');
    const deps = { ...parsed.dependencies, ...parsed.devDependencies };
    return DEPENDENCY_LAYOUTS.find(([name]) => name in deps)?.[1] ?? null;
  } catch {
    return null;
  }
}

class Pending {
  private changes = new Map<string, FileChange>();

  constructor(private base: ReadFile) {}

  read: ReadFile = async (path) => this.changes.get(path)?.after ?? this.base(path);

  put(change: FileChange | null) {
    if (!change) {
      return;
    }
    const earlier = this.changes.get(change.path);
    this.changes.set(change.path, { ...change, before: earlier?.before ?? change.before });
  }

  list(): FileChange[] {
    return [...this.changes.values()];
  }
}

const fontAxis = (weights: number[]) => `wght@${[...weights].sort((a, b) => a - b).join(';')}`;

function clientText(text: string): string {
  return HOOK_CALL.test(text) && !CLIENT_DIRECTIVE.test(text) ? `'use client';\n\n${text}` : text;
}

const TOKENS_IMPORT = `import './${TOKENS_FILE}';`;

const isComponent = (file: ItemFile, target: Target) => target.hosts.some((host) => file.name.endsWith(host));

const withOwnTokens = (file: ItemFile): ItemFile => ({ name: file.name, text: withImport(file.name, file.text, TOKENS_IMPORT, `./${TOKENS_FILE}`).text });

function renamed(file: ItemFile, from: string, to: string, target: Target): ItemFile {
  const name = to + file.name.slice(from.length);
  if (!file.name.endsWith('.tsx') && !file.name.endsWith('.jsx')) {
    return { name, text: file.text };
  }
  const text = file.text.replace(`export function ${from}(`, `export function ${to}(`).replace(`'./${from}.css'`, `'./${to}.css'`);
  return { name, text };
}

const finished = (file: ItemFile, target: Target, ownTokens: boolean): ItemFile => {
  if (!isComponent(file, target)) {
    return file;
  }
  const own = ownTokens ? withOwnTokens(file) : file;
  return target.client ? { name: own.name, text: clientText(own.text) } : own;
};

function rootOf(dir: string, files: ItemFile[], target: Target): LiveAt | null {
  const file = files.find((f) => isComponent(f, target))!;
  const pattern = ROOT_ELEMENTS[target.hosts.find((host) => file.name.endsWith(host))!];
  const start = pattern.exec(file.text)?.indices?.[1][0];
  return start === undefined ? null : { file: `${dir}/${file.name}`, ...lineCol(file.text, start) };
}

type Planned = { name: string; files: ItemFile[]; fresh: ItemFile[] };

async function planned(read: ReadFile, target: Target, item: InsertItem, ownTokens: boolean): Promise<Planned> {
  const source = item.files[target.framework];
  for (let n = 1; ; n++) {
    const name = n === 1 ? item.component : `${item.component}${n}`;
    const files = source.map((f) => finished(renamed(f, item.component, name, target), target, ownTokens));
    const found = await Promise.all(files.map((f) => read(`${target.dir}/${f.name}`)));
    const free = found.every((text, i) => text === null || text === files[i].text);
    if (free) {
      return { name, files, fresh: files.filter((_, i) => found[i] === null) };
    }
  }
}

async function wiredTokens(pending: Pending, target: Target, tokens: string, sheet: string | null) {
  const path = `${target.dir}/${TOKENS_FILE}`;
  if ((await pending.read(path)) === null) {
    pending.put({ path, before: '', after: tokens });
  }
  if (!sheet) {
    return;
  }
  const before = (await pending.read(sheet)) ?? '';
  if (!before.includes(TOKENS_REFERENCE)) {
    const head = before.match(SHEET_IMPORT_LINES)?.[0] ?? '';
    pending.put({ path: sheet, before, after: `${head}@import "${relative(sheet, path)}";\n${before.slice(head.length)}` });
  }
}

async function wiredFonts(pending: Pending, sheet: string | null, item: InsertItem) {
  for (const font of item.fonts) {
    const axis = fontAxis(font.weights);
    pending.put(sheet ? await googleFontImport(pending.read, sheet, font.family, axis) : await googleFontLink(pending.read, font.family, axis));
  }
}

const withScriptImport = (text: string, statement: string, opening: RegExp, created: string): string => {
  const open = text.match(opening);
  if (!open) {
    return `${created}\n${SCRIPT_INDENT}${statement}\n</script>\n\n${text}`;
  }
  const at = open.index! + open[0].length;
  return `${text.slice(0, at)}\n${SCRIPT_INDENT}${statement}${text.slice(at)}`;
};

function withFrontmatterImport(text: string, statement: string): string {
  const open = text.match(/^---[ \t]*\n/);
  if (!open) {
    return `---\n${statement}\n---\n\n${text}`;
  }
  return `${open[0]}${statement}\n${text.slice(open[0].length)}`;
}

function withModuleImport(text: string, statement: string): string {
  const imports = [...text.matchAll(/^import\b[^;]*?['"][^'"]*['"];?[ \t]*$/gm)];
  const last = imports.at(-1);
  if (last) {
    const end = last.index! + last[0].length;
    return `${text.slice(0, end)}\n${statement}${text.slice(end)}`;
  }
  const directive = text.match(/^\s*['"]use client['"];?[ \t]*\n/);
  const at = directive ? directive[0].length : 0;
  return `${text.slice(0, at)}${at ? '\n' : ''}${statement}\n${at ? '' : '\n'}${text.slice(at)}`;
}

const INSTANCE_SCRIPT = /<script(?![^>]*\b(?:module|context="module")\b)[^>]*>/;
const SETUP_SCRIPT = /<script[^>]*\bsetup\b[^>]*>/;

const IMPORT_WRITERS: { host: string; write: (text: string, statement: string) => string }[] = [
  { host: '.svelte', write: (text, s) => withScriptImport(text, s, INSTANCE_SCRIPT, '<script lang="ts">') },
  { host: '.vue', write: (text, s) => withScriptImport(text, s, SETUP_SCRIPT, '<script setup lang="ts">') },
  { host: '.astro', write: withFrontmatterImport },
  { host: '.tsx', write: withModuleImport },
  { host: '.jsx', write: withModuleImport }
];

function withImport(file: string, text: string, statement: string, spec: string): { text: string; at: number } {
  if (text.includes(spec)) {
    return { text, at: -1 };
  }
  const writer = IMPORT_WRITERS.find((w) => file.endsWith(w.host))!;
  const out = writer.write(text, statement);
  const at = [...out].findIndex((_, i) => out[i] !== text[i]);
  return { text: out, at };
}

export async function libraryInsert(read: ReadFile, at: LiveAt, place: AddPlace, item: InsertItem, tokens: string): Promise<Structured> {
  const layout = layoutOf(await read('package.json'));
  if (!layout) {
    return { ok: false, reason: `no ${SUPPORTED} project found in package.json`, at };
  }
  const target = TARGETS[layout];
  if (!target.hosts.some((host) => at.file.endsWith(host))) {
    return { ok: false, reason: `${at.file}: a ${layout} component goes in a ${target.hosts.join(' or ')} file`, at };
  }

  const sheet = await globalSheetOf(read, GLOBAL_SHEETS);
  const plan = await planned(read, target, item, sheet === null);
  const used = await addMarkup(read, at, target.tag(plan.name), place);
  if (!used.ok) {
    return used;
  }

  const pending = new Pending(read);
  for (const file of plan.fresh) {
    pending.put({ path: `${target.dir}/${file.name}`, before: '', after: file.text });
  }
  await wiredTokens(pending, target, tokens, sheet);
  await wiredFonts(pending, sheet, item);

  const usage = used.changes[0];
  const spec = target.importFrom(at.file, `${target.dir}/${plan.name}`);
  const start = offsetOf(usage.after, used.selected!);
  const imported = spec === null ? { text: usage.after, at: -1 } : withImport(at.file, usage.after, target.statement(plan.name, spec + target.suffix), spec + target.suffix);
  const shift = imported.at >= 0 && imported.at <= start ? imported.text.length - usage.after.length : 0;
  pending.put({ path: at.file, before: usage.before, after: imported.text });

  return { ok: true, changes: pending.list(), selected: rootOf(target.dir, plan.files, target) ?? { file: at.file, ...lineCol(imported.text, start + shift) } };
}
