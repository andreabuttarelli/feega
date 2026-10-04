export enum CostTier {
  Low = '$',
  Mid = '$$',
  High = '$$$'
}

export type ChatModelOption = {
  id: string;
  label: string;
  provider: string;
  costTier: CostTier;
  inputUsdPerM: number;
  outputUsdPerM: number;
  efforts: string[];
  defaultEffort: string | null;
};

export type ChatModelChoice = { model: string; reasoning: string | null };

export type ChatModelGroup = { provider: string; options: ChatModelOption[] };

export const DEFAULT_CHAT_CHOICE: ChatModelChoice = { model: 'anthropic/claude-sonnet-5.5', reasoning: 'medium' };

export function defaultEffortOf(option: ChatModelOption): string | null {
  const preferred = option.id === DEFAULT_CHAT_CHOICE.model ? DEFAULT_CHAT_CHOICE.reasoning : null;
  if (preferred && option.efforts.includes(preferred)) {
    return preferred;
  }
  if (option.defaultEffort && option.efforts.includes(option.defaultEffort)) {
    return option.defaultEffort;
  }
  return option.efforts[0] ?? null;
}

export function groupByProvider(options: readonly ChatModelOption[]): ChatModelGroup[] {
  const groups = new Map<string, ChatModelOption[]>();
  for (const option of options) {
    groups.set(option.provider, [...(groups.get(option.provider) ?? []), option]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([provider, list]) => ({ provider, options: [...list].sort((a, b) => a.label.localeCompare(b.label)) }));
}

export function shortLabel(option: ChatModelOption): string {
  const colon = option.label.indexOf(': ');
  return colon === -1 ? option.label : option.label.slice(colon + 2);
}
