export type Imported = { ok: true; after: string } | { ok: false; reason: string };

type Home = (source: string, line: string) => Imported;

const SCRIPT_BLOCK = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
const IMPORT_STATEMENT = /^[ \t]*import\b[\s\S]*?(?:from\s*)?['"][^'"]+['"];?[ \t]*$/gm;
const DIRECTIVE = /^(?:\s*(['"])use (?:client|server)\1;?[ \t]*\n)+/;
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/;
const MODULE_SCRIPT = /\b(?:module|context\s*=\s*["']module["'])/;
const SETUP_SCRIPT = /\bsetup\b/;
const SCRIPT_INDENT = '  ';
const COMPONENT_EXTENSIONS = /\.(?:tsx|jsx)$/;

const dirOf = (path: string) => path.split('/').slice(0, -1);

export function relativeImport(from: string, to: string): string {
  const base = dirOf(from);
  const target = to.split('/');
  let shared = 0;
  while (shared < base.length && shared < target.length - 1 && base[shared] === target[shared]) {
    shared++;
  }
  const ups = base.length - shared;
  const path = [...(ups ? Array<string>(ups).fill('..') : ['.']), ...target.slice(shared)].join('/');
  return path.replace(COMPONENT_EXTENSIONS, '');
}

export const importLine = (name: string, path: string) => `import ${name} from '${path}';`;

function afterLastImport(body: string, line: string, indent: string): string {
  const imports = [...body.matchAll(IMPORT_STATEMENT)];
  const last = imports.at(-1);
  if (last) {
    const end = last.index + last[0].length;
    return `${body.slice(0, end)}\n${indent}${line}${body.slice(end)}`;
  }
  const directive = body.match(DIRECTIVE)?.[0] ?? '';
  const rest = body.slice(directive.length);
  return `${directive}${directive ? '\n' : ''}${indent}${line}\n${rest.replace(/^\n/, '')}`;
}

function inBlock(source: string, line: string, pick: (attributes: string) => boolean, fresh: string): Imported {
  const block = [...source.matchAll(SCRIPT_BLOCK)].find((m) => pick(m[1]));
  if (!block) {
    return { ok: true, after: `${fresh}\n  ${line}\n</script>\n\n${source}` };
  }
  const bodyStart = block.index + block[0].indexOf('>') + 1;
  const body = block[2];
  const imports = [...body.matchAll(IMPORT_STATEMENT)];
  if (!imports.length) {
    return { ok: true, after: `${source.slice(0, bodyStart)}\n${SCRIPT_INDENT}${line}${source.slice(bodyStart)}` };
  }
  const indent = body.match(/\n([ \t]*)import\b/)?.[1] ?? '';
  return { ok: true, after: source.slice(0, bodyStart) + afterLastImport(body, line, indent) + source.slice(bodyStart + body.length) };
}

const svelte: Home = (source, line) => inBlock(source, line, (attributes) => !MODULE_SCRIPT.test(attributes), '<script>');

function vue(source: string, line: string): Imported {
  const blocks = [...source.matchAll(SCRIPT_BLOCK)];
  if (blocks.length && !blocks.some((m) => SETUP_SCRIPT.test(m[1]))) {
    return { ok: false, reason: 'this Vue file uses the options API: it needs a <script setup> to import a component' };
  }
  const out = inBlock(source, line, (attributes) => SETUP_SCRIPT.test(attributes), '<script setup>');
  return out.ok && !blocks.length ? { ok: true, after: out.after.replace('\n  import', '\nimport') } : out;
}

function astro(source: string, line: string): Imported {
  const front = source.match(FRONTMATTER);
  if (!front) {
    return { ok: true, after: `---\n${line}\n---\n${source}` };
  }
  const body = front[1];
  const imports = [...body.matchAll(IMPORT_STATEMENT)];
  const last = imports.at(-1);
  const at = last ? last.index + last[0].length : 0;
  const next = last ? `${body.slice(0, at)}\n${line}${body.slice(at)}` : `${line}\n${body}`;
  return { ok: true, after: `---\n${next}${source.slice(front[0].length - 5)}` };
}

const moduleFile: Home = (source, line) => ({ ok: true, after: afterLastImport(source, line, '') });

const HOMES: Record<string, Home> = { svelte, vue, astro, tsx: moduleFile, jsx: moduleFile, ts: moduleFile, js: moduleFile };

export function addImport(file: string, source: string, line: string): Imported {
  const home = HOMES[file.slice(file.lastIndexOf('.') + 1)];
  if (!home) {
    return { ok: false, reason: `${file}: cannot add an import to this kind of file` };
  }
  return source.includes(line) ? { ok: true, after: source } : home(source, line);
}
