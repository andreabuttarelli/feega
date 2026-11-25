import type { ClassTarget } from '@feega/live-edit/class-rule';
import { ClassScope, type RuleSite } from '@feega/live-edit/class-index';
import type { ClassInfo } from '../messages';

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

export const usageLabel = (info: ClassInfo) => (info.elements === 0 ? 'not used' : `${count(info.elements, 'element')} · ${count(info.files, 'file')}`);

const SCOPE_LABEL: Record<ClassScope, string> = {
  [ClassScope.Global]: 'global',
  [ClassScope.Module]: 'module',
  [ClassScope.Component]: 'component'
};

export const editingLabel = (info: ClassInfo) => `Editing: .${info.name} (${SCOPE_LABEL[info.scope]})`;

export const editTarget = (info: ClassInfo): ClassTarget | null => (info.home ? { name: info.name, file: info.home.file } : null);

export function ruleContext(rule: RuleSite): string {
  if (!rule.own) {
    return rule.selector;
  }
  return [rule.state, rule.media && `@media ${rule.media}`].filter(Boolean).join(' · ');
}

export const declarationsLabel = (declarations: Record<string, string>) =>
  Object.entries(declarations)
    .map(([prop, value]) => `${prop}: ${value}`)
    .join('; ');
