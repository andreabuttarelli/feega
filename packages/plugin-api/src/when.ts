import type { Selection } from './protocol';

type Rule = { match: RegExp; holds: (argument: string, selection: Selection | null) => boolean };

const hasAttribute = (name: string, selection: Selection | null) => selection?.attributes.some((a) => a.name === name) ?? false;

const RULES: Rule[] = [
  { match: /^selection$/, holds: (_, selection) => selection !== null },
  { match: /^attribute:(.+)$/, holds: (name, selection) => hasAttribute(name, selection) },
  { match: /^!attribute:(.+)$/, holds: (name, selection) => !hasAttribute(name, selection) }
];

const ruleOf = (condition: string) => RULES.find((rule) => rule.match.test(condition));

export const isCondition = (condition: string) => ruleOf(condition) !== undefined;

export const holds = (when: string[] | undefined, selection: Selection | null): boolean =>
  (when ?? []).every((condition) => {
    const rule = ruleOf(condition);
    return rule ? rule.holds(condition.match(rule.match)?.[1] ?? '', selection) : false;
  });
