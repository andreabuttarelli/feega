import { offsetOf, openTagEnd, type LiveAt } from './class-patch';
import type { FileChange, ReadFile } from './files';
import { ruleInBody, Scope } from './scoped-rule';
import type { Css } from './style-attr';

export type ModuleWritten = { ok: true; changes: FileChange[] } | { ok: false; reason: string; at?: LiveAt };

const MODULE_IMPORT = /import\s+(\w+)\s+from\s+['"](\.{1,2}\/[^'"]+\.module\.css)['"];?/;
const MODULE_CLASS = /\sclassName=\{(\w+)\.([A-Za-z_]\w*)\}/;
const MODULE_CLASSES = /\sclassName=\{`((?:\$\{\w+\.[A-Za-z_]\w*\}\s*)+)`\}/;
const CLASS_REF = /\$\{\w+\.([A-Za-z_]\w*)\}/g;
const CLASS_ANY = /\sclassName=/;
const TAG_NAME = /^<([a-zA-Z][\w-]*)/;
const MODULE_NAME = 'styles';
const NO_INDENT = '';

const dirOf = (file: string) => file.slice(0, file.lastIndexOf('/') + 1);
const baseOf = (file: string) => file.slice(file.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '');
const camelBase = (file: string) => baseOf(file).charAt(0).toLowerCase() + baseOf(file).slice(1);

function joinPath(dir: string, relative: string): string {
  const parts = dir.split('/').filter(Boolean);
  for (const piece of relative.split('/')) {
    if (piece === '..') {
      parts.pop();
    } else if (piece !== '.') {
      parts.push(piece);
    }
  }
  return parts.join('/');
}

function freeName(css: string, base: string): string {
  let name = base;
  for (let n = 2; new RegExp(`\\.${name}\\b`).test(css); n++) {
    name = `${base}${n}`;
  }
  return name;
}

function usedClasses(open: string): { names: string[]; attr: string } | null {
  const single = open.match(MODULE_CLASS);
  if (single) {
    return { names: [single[2]], attr: single[0] };
  }
  const many = open.match(MODULE_CLASSES);
  return many ? { names: [...many[1].matchAll(CLASS_REF)].map((m) => m[1]), attr: many[0] } : null;
}

const ownOf = (names: string[], base: string) => names.find((n) => n === base || new RegExp(`^${base}\\d+$`).test(n));

const classAttr = (binding: string, names: string[]) =>
  names.length === 1 ? ` className={${binding}.${names[0]}}` : ` className={\`${names.map((n) => `\${${binding}.${n}}`).join(' ')}\`}`;

export async function cssModuleRule(read: ReadFile, at: LiveAt, css: Css, viewport?: number, scope = Scope.Element, inner?: string): Promise<ModuleWritten> {
  const ruleName = (name: string) => (inner ? `${name} ${inner}` : name);
  const source = await read(at.file);
  const start = source === null ? -1 : offsetOf(source, at);
  const end = start < 0 || source![start] !== '<' ? -1 : openTagEnd(source!, start);
  if (end < 0) {
    return { ok: false, reason: `${at.file}:${at.line}: the element is not where the page says` };
  }

  const text = source!;
  const open = text.slice(start, end + 1);
  const used = usedClasses(open);
  if (!used && CLASS_ANY.test(open)) {
    return { ok: false, reason: `${at.file}:${at.line}: className is not a CSS module class, not written`, at };
  }

  const imported = text.match(MODULE_IMPORT);
  const binding = imported?.[1] ?? MODULE_NAME;
  const modulePath = imported ? joinPath(dirOf(at.file), imported[2]) : `${dirOf(at.file)}${baseOf(at.file)}.module.css`;
  const before = (await read(modulePath)) ?? '';
  const declared = new Map(Object.entries(css));
  const tag = open.match(TAG_NAME)![1];
  const base = `${camelBase(at.file)}${tag.charAt(0).toUpperCase()}${tag.slice(1)}`;
  const names = used?.names ?? [];
  const kept = scope === Scope.Class ? names[0] : ownOf(names, base);

  if (kept) {
    return { ok: true, changes: [{ path: modulePath, before, after: ruleInBody(before, ruleName(kept), declared, viewport, NO_INDENT) }] };
  }

  const name = freeName(before, base);
  const attr = classAttr(binding, [...names, name]);
  const closing = open.endsWith('/>') ? open.length - 2 : open.length - 1;
  const tagged = used ? open.replace(used.attr, attr) : `${open.slice(0, closing).trimEnd()}${attr}${open.slice(closing)}`;
  let after = text.slice(0, start) + tagged + text.slice(end + 1);
  if (!imported) {
    after = `import ${binding} from './${baseOf(at.file)}.module.css';\n${after}`;
  }
  return {
    ok: true,
    changes: [
      { path: at.file, before: text, after },
      { path: modulePath, before, after: ruleInBody(before, ruleName(name), declared, viewport, NO_INDENT) }
    ]
  };
}
