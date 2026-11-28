import type { Selection } from './protocol';

type Rule = { match: RegExp; holds: (argument: string, selection: Selection | null, owns: string[]) => boolean };

const OWNED = 'owned';

const hasAttribute = (name: string, selection: Selection | null) => selection?.attributes.some((a) => a.name === name) ?? false;

const styleHas = (argument: string, selection: Selection | null) => {
  const [property, text] = argument.split('*=');
  return selection?.styles[property]?.includes(text) ?? false;
};

const RULES: Rule[] = [
  { match: /^selection$/, holds: (_, selection) => selection !== null },
  { match: /^attribute:(.+)$/, holds: (name, selection) => hasAttribute(name, selection) },
  { match: /^!attribute:(.+)$/, holds: (name, selection) => !hasAttribute(name, selection) },
  { match: /^style:([a-z-]+\*=.+)$/, holds: (argument, selection) => styleHas(argument, selection) },
  { match: new RegExp(`^${OWNED}$`), holds: (_, selection, owns) => owns.length > 0 && holds(owns, selection) }
];

const ruleOf = (condition: string) => RULES.find((rule) => rule.match.test(condition));

export const isCondition = (condition: string) => ruleOf(condition) !== undefined;

export const isOwnership = (condition: string) => condition !== OWNED && isCondition(condition);

export function holds(when: string[] | undefined, selection: Selection | null, owns: string[] = []): boolean {
  return (when ?? []).every((condition) => {
    const rule = ruleOf(condition);
    return rule ? rule.holds(condition.match(rule.match)?.[1] ?? '', selection, owns) : false;
  });
}
