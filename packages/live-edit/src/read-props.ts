import type { LiveAt } from './class-patch';
import type { ReadFile } from './files';
import { attributesOf } from './open-tag';
import { DYNAMIC, nameOf, spreads, syntaxOf, valueIn, type Json } from './prop-syntax';
import { locateUsage, type Which } from './usage-tag';

export type ReadAsk = { component: string; usage: LiveAt; which?: Which };

export type Read = { ok: true; values: Record<string, Json>; dynamic: string[]; spread: boolean } | { ok: false; reason: string };

const camel = (name: string) => name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());

export async function readProps(read: ReadFile, ask: ReadAsk): Promise<Read> {
  const syntax = syntaxOf(ask.usage.file);
  if (!syntax) {
    return { ok: false, reason: `${ask.usage.file}: reading props works on React, Svelte, Vue and Astro files` };
  }

  const located = await locateUsage(read, ask.component, ask.usage, ask.which);
  if (!located.ok) {
    return located;
  }

  const { page, tagAt } = located.found;
  const attributes = attributesOf(page, tagAt);
  const values: Record<string, Json> = {};
  const dynamic: string[] = [];
  for (const attribute of attributes.filter((a) => !spreads(a))) {
    const name = camel(nameOf(attribute));
    const value = valueIn(syntax, attribute);
    if (value === DYNAMIC) {
      dynamic.push(name);
    } else {
      values[name] = value;
    }
  }

  return { ok: true, values, dynamic, spread: attributes.some(spreads) };
}
