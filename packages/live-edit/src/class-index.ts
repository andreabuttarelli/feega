import { ClassScope, rulesOf, type RuleSite, type SheetRule } from './class-rules';
import { classUsesOf, type ClassUse } from './class-uses';

export { ClassScope };

export type UseSite = { file: string; line: number; dynamic: boolean };

export type ClassEntry = { key: string; name: string; scope: ClassScope; sheet: string; rules: RuleSite[]; uses: UseSite[]; home: RuleSite | null };

export type ClassIndex = Map<string, ClassEntry>;

export type FileFacts = { rules: SheetRule[]; uses: ClassUse[] };

const KEY_SEPARATOR = '#';

export const factsOf = (file: string, text: string): FileFacts => ({ rules: rulesOf(file, text), uses: classUsesOf(file, text) });

const keyOf = (scope: ClassScope, sheet: string, name: string) => (scope === ClassScope.Global ? name : `${sheet}${KEY_SEPARATOR}${name}`);

const homeOf = (rules: RuleSite[]): RuleSite | null => rules.find((r) => r.own && !r.state && !r.media) ?? rules.find((r) => r.own) ?? null;

export function entryOf(index: ClassIndex, use: ClassUse, file: string): ClassEntry | undefined {
  if (use.module) {
    return index.get(keyOf(ClassScope.Module, use.module, use.name));
  }
  return index.get(keyOf(ClassScope.Component, file, use.name)) ?? index.get(keyOf(ClassScope.Global, '', use.name));
}

export function buildIndex(facts: Map<string, FileFacts>): ClassIndex {
  const index: ClassIndex = new Map();
  for (const [file, { rules }] of facts) {
    for (const rule of rules) {
      const key = keyOf(rule.scope, file, rule.name);
      const entry = index.get(key) ?? { key, name: rule.name, scope: rule.scope, sheet: file, rules: [], uses: [], home: null };
      entry.rules.push({ file: rule.file, line: rule.line, selector: rule.selector, state: rule.state, media: rule.media, declarations: rule.declarations, own: rule.own });
      index.set(key, entry);
    }
  }
  for (const entry of index.values()) {
    entry.home = homeOf(entry.rules);
  }
  for (const [file, { uses }] of facts) {
    for (const use of uses) {
      entryOf(index, use, file)?.uses.push({ file, line: use.line, dynamic: use.dynamic });
    }
  }
  return index;
}

const signatureOf = (rule: RuleSite) =>
  Object.entries(rule.declarations)
    .map(([prop, value]) => `${prop}:${value}`)
    .sort()
    .join(';');

export function duplicatesOf(index: ClassIndex): ClassEntry[][] {
  const groups = new Map<string, ClassEntry[]>();
  for (const entry of index.values()) {
    const signature = entry.home ? signatureOf(entry.home) : '';
    if (signature) {
      groups.set(signature, [...(groups.get(signature) ?? []), entry]);
    }
  }
  return [...groups.values()].filter((group) => group.length > 1);
}
