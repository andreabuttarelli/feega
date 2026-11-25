import type { LiveAt } from './class-patch';
import type { ReadFile } from './files';
import type { Structured } from './move-into';
import { addImport } from './add-import';
import { loopsAt } from './loop-array';
import { spanOf } from './move-node';
import { baseOf, escaped, kebab, locateUsage, type Which } from './usage-tag';

export type { Which };

export type DetachAsk = { element: LiveAt; usage: LiveAt; which?: Which };

type Renamer = (source: string, from: string, to: string) => string | null;

const REFUSED_KIND = 'detach works on React, Svelte, Vue and Astro components';
const ROUTE_FILES = new Set(['index', 'page', '+page', 'layout', '+layout', '_app', 'root']);
const ROOT_FOLDERS = new Set(['', 'src', 'app', 'pages', 'routes', 'components']);
const HOME_NAME = 'Home';

const pascal = (text: string) => text.split(/[^a-zA-Z0-9]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('');
const extOf = (file: string) => file.slice(file.lastIndexOf('.'));
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
  const { element, usage, which } = ask;
  const ext = extOf(element.file);
  const rename = RENAMERS[ext];
  if (!rename) {
    return { ok: false, reason: `${element.file}: ${REFUSED_KIND}` };
  }

  const component = await read(element.file);
  if (component === null) {
    return { ok: false, reason: `${element.file}: cannot read the file` };
  }

  const from = baseOf(element.file);
  const located = await locateUsage(read, element.file, usage, which);
  if (!located.ok) {
    return located;
  }

  const { page, hidden, binding, tagAt } = located.found;
  const refuse = (reason: string): Structured => ({ ok: false, reason: `${usage.file}: ${reason}` });
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
