import { offsetOf, type LiveAt } from './class-patch';
import type { ReadFile } from './files';
import { hiddenOut, spanOf } from './move-node';

export type Which = { index: number; count: number };

export type Binding = { local: string; named: boolean; statement: string; quote: string; specifier: string };

export type UsageTag = { page: string; hidden: string; binding: Binding; tagAt: number };

export type Located = { ok: true; found: UsageTag } | { ok: false; reason: string };

const IMPORT = /import\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\}\s*)?from\s*(['"])([^'"]+)\3;?/g;

export const kebab = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
export const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const baseOf = (file: string) => file.slice(file.lastIndexOf('/') + 1, file.lastIndexOf('.'));

export function bindingOf(source: string, name: string): Binding | null {
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

export async function locateUsage(read: ReadFile, component: string, usage: LiveAt, which?: Which): Promise<Located> {
  const page = await read(usage.file);
  if (page === null) {
    return { ok: false, reason: `${usage.file}: cannot read the file` };
  }

  const from = baseOf(component);
  const refuse = (reason: string): Located => ({ ok: false, reason: `${usage.file}: ${reason}` });
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
  const chosen = inside.length === 1 ? inside[0] : which && which.count === inside.length ? inside[which.index] : undefined;
  if (!chosen) {
    return refuse(inside.length ? `${inside.length} <${binding.local}> usages in this element: cannot tell which one this is` : `no <${binding.local}> usage in this element (a dynamic component?)`);
  }

  return { ok: true, found: { page, hidden, binding, tagAt: parent.start + 1 + chosen.index } };
}
