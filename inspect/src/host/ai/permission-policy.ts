import type { OptionView } from './agent-session';

export enum Policy {
  Ask = 'ask',
  Edits = 'edits',
  All = 'all'
}

export type PolicyRow = { id: Policy; name: string; hint: string; danger: boolean };

export const POLICY_ROWS: PolicyRow[] = [
  { id: Policy.Ask, name: 'Ask every time', hint: 'Every tool call waits for your answer.', danger: false },
  { id: Policy.Edits, name: 'Allow edits, ask for commands', hint: 'File edits and reads go through; commands and fetches ask.', danger: false },
  { id: Policy.All, name: 'Allow all', hint: 'The agent runs anything without asking.', danger: true }
];

const EDIT_KINDS = new Set(['edit', 'delete', 'move', 'read', 'search', 'think']);

const AUTO: Record<Policy, (kind: string) => boolean> = {
  [Policy.Ask]: () => false,
  [Policy.Edits]: (kind) => EDIT_KINDS.has(kind),
  [Policy.All]: () => true
};

export const isPolicy = (value: unknown): value is Policy => POLICY_ROWS.some((row) => row.id === value);

export const autoAnswer = (policy: Policy, toolKind: string, options: OptionView[]): string | null => (AUTO[policy](toolKind) ? (options.find((o) => o.allows)?.id ?? null) : null);

export const policyOf = (saved: unknown, configured: unknown): Policy => [saved, configured].find(isPolicy) ?? Policy.Ask;
