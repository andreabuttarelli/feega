import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Delimiter, attributesOf, type Attribute } from '@feega/live-edit/open-tag';
import { DYNAMIC, nameOf, spreads, syntaxOf, valueIn, type Json } from '@feega/live-edit/prop-syntax';
import { UNRESOLVED, valueOfExpression, type Lookup, type Resolved } from './expression-value';
import { Scopes, escaped } from './module-scope';

export type ComponentExample = { id: string; file: string; line: number; props: Record<string, Json>; unresolved: string[] };

const camel = (name: string) => name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());

const lineAt = (text: string, offset: number) => text.slice(0, offset).split('\n').length;

const toJson = (value: Resolved): Json | undefined => (value === UNRESOLVED ? undefined : (value as Json));

const expressionOf = ({ delimiter, name, value }: Attribute): string => (delimiter === Delimiter.Shorthand ? name : (value ?? ''));

function exampleOf(file: string, page: string, tagAt: number, lookup: Lookup): ComponentExample | null {
  const syntax = syntaxOf(file);
  if (!syntax) {
    return null;
  }
  const props: Record<string, Json> = {};
  const unresolved: string[] = [];
  for (const attribute of attributesOf(page, tagAt).filter((a) => !spreads(a))) {
    const name = camel(nameOf(attribute));
    const literal = valueIn(syntax, attribute);
    const value = literal === DYNAMIC ? toJson(valueOfExpression(expressionOf(attribute), lookup)) : literal;
    if (value === undefined) {
      unresolved.push(name);
      continue;
    }
    props[name] = value;
  }
  const line = lineAt(page, tagAt);

  return { id: `${file}:${line}`, file, line, props, unresolved };
}

export async function examplesOf(root: string, name: string, users: string[]): Promise<ComponentExample[]> {
  const scopes = new Scopes(root);
  const opening = new RegExp(`<${escaped(name)}(?=[\\s/>])`, 'g');
  const found: ComponentExample[] = [];

  for (const file of [...new Set(users)]) {
    const page = await readFile(join(root, file), 'utf8').catch(() => '');
    const tags = [...page.matchAll(opening)];
    if (tags.length === 0) {
      continue;
    }
    const lookup = await scopes.lookup(file, page, 0, [file]);
    found.push(...tags.flatMap((tag) => exampleOf(file, page, tag.index, lookup) ?? []));
  }

  return found;
}
