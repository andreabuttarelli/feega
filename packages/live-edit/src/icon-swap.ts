import { offsetOf, type LiveAt } from './class-patch';
import { elementRange } from './element-range';
import type { FileChange, ReadFile } from './files';
import { ImportStyle, type IconLibrary } from './icon-library';

export type SwapWritten = { ok: true; change: FileChange } | { ok: false; reason: string };

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const usesOf = (text: string, tag: string) => (text.match(new RegExp(`<${tag}(?=[\\s/>])`, 'g')) ?? []).length;

const refused = (at: LiveAt, library: IconLibrary): SwapWritten => ({ ok: false, reason: `${at.file}:${at.line}: this element is not an icon of ${library.pkg}` });

function renamedElement(text: string, start: number, from: string, to: string): string | null {
  const range = elementRange(text, start);
  if (!range || range.tag !== from) {
    return null;
  }
  const closing = text.slice(range.closeStart, range.end).replace(`</${from}>`, `</${to}>`);
  return text.slice(0, start) + `<${to}` + text.slice(start + from.length + 1, range.closeStart) + closing + text.slice(range.end);
}

function namedImport(text: string, from: string, to: string, library: IconLibrary): string | null {
  const statement = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*(['"])${escaped(library.pkg)}[^'"]*\\2`);
  const found = text.match(statement);
  const names = found?.[1].split(',').map((n) => n.trim()).filter(Boolean);
  if (!found || !names?.includes(from)) {
    return null;
  }
  const kept = usesOf(text, from) > 0;
  const next = names.flatMap((n) => (n !== from ? [n] : kept ? [n, to] : [to]));
  const unique = next.filter((n, i) => next.indexOf(n) === i);
  return text.replace(found[0], found[0].replace(/\{[^}]*\}/, `{ ${unique.join(', ')} }`));
}

function pathImport(text: string, from: string, to: string, name: string, library: IconLibrary): string | null {
  const statement = new RegExp(`import\\s+${from}\\s+from\\s+(['"])(${escaped(library.pkg)}/[^'"]*/)[^'"/]+\\1;?`);
  const found = text.match(statement);
  if (!found) {
    return null;
  }
  const made = `import ${to} from ${found[1]}${found[2]}${name}${found[1]};`;
  return text.replace(found[0], usesOf(text, from) > 0 ? `${found[0]}\n  ${made}` : made);
}

function attributeValue(text: string, start: number, name: string): string | null {
  const range = elementRange(text, start);
  const open = range ? text.slice(start, range.openEnd) : '';
  const found = open.match(/\sicon=(['"])[^'"]*\1/);
  return range && found ? text.slice(0, start) + open.replace(found[0], ` icon="${name}"`) + text.slice(range.openEnd) : null;
}

export async function swapIcon(read: ReadFile, at: LiveAt, name: string, library: IconLibrary): Promise<SwapWritten> {
  const source = await read(at.file);
  const start = source === null ? -1 : offsetOf(source, at);
  if (source === null || start < 0 || source[start] !== '<') {
    return { ok: false, reason: `${at.file}:${at.line}: the element is not where the page says` };
  }

  if (library.style === ImportStyle.Attribute) {
    const after = attributeValue(source, start, name);
    return after ? { ok: true, change: { path: at.file, before: source, after } } : refused(at, library);
  }

  const from = source.slice(start).match(/^<([A-Za-z][\w]*)/)?.[1] ?? '';
  const to = library.component(name);
  const moved = renamedElement(source, start, from, to);
  const after = moved && (library.style === ImportStyle.Named ? namedImport(moved, from, to, library) : pathImport(moved, from, to, name, library));
  return after ? { ok: true, change: { path: at.file, before: source, after } } : refused(at, library);
}
