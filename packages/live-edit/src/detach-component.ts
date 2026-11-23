import { offsetOf, type LiveAt } from './class-patch';
import type { ReadFile } from './files';
import type { Structured } from './move-into';
import { addImport } from './add-import';
import { loopsAt } from './loop-array';
import { hiddenOut, spanOf } from './move-node';

export type DetachAsk = { element: LiveAt; usage: LiveAt };

type Binding = { local: string; named: boolean; statement: string; quote: string; specifier: string };

type Renamer = (source: string, from: string, to: string) => string | null;

const REFUSED_KIND = 'detach works on React, Svelte, Vue and Astro components';
const ROUTE_FILES = new Set(['index', 'page', '+page', 'layout', '+layout', '_app', 'root']);
const ROOT_FOLDERS = new Set(['', 'src', 'app', 'pages', 'routes', 'components']);
const HOME_NAME = 'Home';
const IMPORT = /import\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\}\s*)?from\s*(['"])([^'"]+)\3;?/g;

const kebab = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const pascal = (text: string) => text.split(/[^a-zA-Z0-9]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('');
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const extOf = (file: string) => file.slice(file.lastIndexOf('.'));
const baseOf = (file: string) => file.slice(file.lastIndexOf('/') + 1, file.lastIndexOf('.'));
const dirOf = (file: string) => file.slice(0, file.lastIndexOf('/') + 1);

const REACT_DECLARATIONS = (from: string) => [
  new RegExp(`\\b(function|class|const|let|var)\\s+${from}\\b`, 'g'),
  new RegExp(`(?<=\\bexport\\s+default\\s+)${from}\\b`, 'g'),
  new RegExp(`\\b${from}(?=\\.(?:displayName|defaultProps|propTypes)\\b)`, 'g'),
  new RegExp(`(?<=<\\/?)${from}(?=[\\s/>])`, 'g')
];

function renamedReact(source: string, from: string, to: string): string | null {
  const [declaration, ...rest] = REACT_DECLARATIONS(escaped(from));
  if (!declaration.test(source)) {
    return null;
  }
  const exported = source.replace(/\bexport\s*\{([^}]*)\}/g, (all, names: string) => all.replace(names, names.replace(new RegExp(`\\b${escaped(from)}\\b`), to)));
  return rest.reduce((text, pattern) => text.replace(pattern, to), exported.replace(declaration, `$1 ${to}`));
}

const same: Renamer = (source) => source;

const RENAMERS: Record<string, Renamer> = { '.tsx': renamedReact, '.jsx': renamedReact, '.svelte': same, '.vue': same, '.astro': same };

function parentName(file: string, from: string): string {
  const base = baseOf(file);
  const folder = dirOf(file).split('/').filter(Boolean).at(-1) ?? '';
  const named = ROUTE_FILES.has(base) ? (ROOT_FOLDERS.has(folder) ? HOME_NAME : pascal(folder)) : pascal(base);
  return named && named !== from ? named : `${from}Copy`;
}

async function freeName(read: ReadFile, dir: string, from: string, parent: string, ext: string): Promise<string> {
  for (let n = 1; ; n++) {
    const name = `${from}${parent}${n > 1 ? n : ''}`;
    if ((await read(`${dir}${name}${ext}`)) === null) {
      return name;
    }
  }
}

function bindingOf(source: string, name: string): Binding | null {
  for (const m of source.matchAll(IMPORT)) {
    const specifier = m[4];
    const last = specifier.slice(specifier.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '');
    if (last !== name) {
      continue;
    }
    if (m[1]) {
      return { local: m[1], named: false, statement: m[0], quote: m[3], specifier };
    }
    const entry = m[2]?.split(',').map((s) => s.trim()).find((s) => s === name);
    if (entry) {
      return { local: name, named: true, statement: m[0], quote: m[3], specifier };
    }
  }
  return null;
}

const nameInSpecifier = (specifier: string, from: string, to: string) => specifier.replace(new RegExp(`${escaped(from)}(?=(\\.[^./]+)?$)`), to);

function rewriteUsage(source: string, hidden: string, tagAt: number, local: string, to: string): string {
  const span = spanOf(hidden, tagAt);
  const open = hidden.slice(tagAt + 1, tagAt + 1 + local.length);
  const name = open === local ? to : kebab(to);
  const piece = source.slice(span!.start, span!.end);
  const close = piece.lastIndexOf('</');
  const closed = close > 0 ? `${piece.slice(0, close)}</${name}${piece.slice(close + 2 + open.length)}` : piece;
  return source.slice(0, span!.start) + `<${name}${closed.slice(1 + open.length)}` + source.slice(span!.end);
}

export async function detachComponent(read: ReadFile, ask: DetachAsk): Promise<Structured> {
  const { element, usage } = ask;
  const ext = extOf(element.file);
  const rename = RENAMERS[ext];
  if (!rename) {
    return { ok: false, reason: `${element.file}: ${REFUSED_KIND}` };
  }

  const [component, page] = await Promise.all([read(element.file), read(usage.file)]);
  if (component === null || page === null) {
    return { ok: false, reason: `${component === null ? element.file : usage.file}: cannot read the file` };
  }

  const from = baseOf(element.file);
  const refuse = (reason: string): Structured => ({ ok: false, reason: `${usage.file}: ${reason}` });
  const binding = bindingOf(page, from);
  if (!binding) {
    return refuse(`${from} is not imported straight from its file (a re-export?)`);
  }

  const hidden = hiddenOut(page);
  const parent = spanOf(hidden, offsetOf(hidden, usage));
  if (!parent) {
    return refuse('the element is not where the page says');
  }

  const tags = new RegExp(`<(?:${escaped(binding.local)}|${escaped(kebab(binding.local))})(?=[\\s/>])`, 'g');
  const inside = [...hidden.slice(parent.start + 1, parent.end).matchAll(tags)];
  if (inside.length !== 1) {
    return refuse(inside.length ? `${inside.length} <${binding.local}> usages in this element: cannot tell which one this is` : `no <${binding.local}> usage in this element (a dynamic component?)`);
  }

  const tagAt = parent.start + 1 + inside[0].index;
  if (loopsAt(hidden, tagAt).length) {
    return refuse('the usage is rendered in a loop: every iteration shares it');
  }

  const to = await freeName(read, dirOf(element.file), from, parentName(usage.file, from), ext);
  const copy = rename(component, from, to);
  if (copy === null) {
    return { ok: false, reason: `${element.file}: cannot find where ${from} is declared` };
  }

  const q = binding.quote;
  const bound = binding.named ? `{ ${to} }` : to;
  const line = `import ${bound} from ${q}${nameInSpecifier(binding.specifier, from, to)}${q}${binding.statement.endsWith(';') ? ';' : ''}`;
  const rewritten = rewriteUsage(page, hidden, tagAt, binding.local, to);
  const imported = addImport(usage.file, rewritten, line);
  if (!imported.ok) {
    return refuse(imported.reason);
  }

  return {
    ok: true,
    changes: [
      { path: `${dirOf(element.file)}${to}${ext}`, before: '', after: copy },
      { path: usage.file, before: page, after: imported.after }
    ],
    selected: { file: `${dirOf(element.file)}${to}${ext}`, line: element.line, col: element.col }
  };
}
