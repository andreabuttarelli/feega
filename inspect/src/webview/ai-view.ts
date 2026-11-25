import { AgentId, AiState } from '../messages';
import { AGENT_LOGOS, type AgentLogo } from './agent-logos';
import { POLICY_ROWS, type Policy } from '../host/ai/permission-policy';
import type { ConfigCategory, ConfigView, ModeView } from '../host/ai/agent-session';
import { ItemKind, type Item } from '../host/ai/transcript';

export enum Dot {
  Grey = 'grey',
  Amber = 'amber',
  Green = 'green'
}

export type Status = { label: string; dot: Dot };

export const SUGGESTIONS = ['Make this more spacious', 'Match the button styles', 'Explain this component'];

const STATUS: Record<AiState, Status> = {
  [AiState.Idle]: { label: 'Not connected', dot: Dot.Grey },
  [AiState.Starting]: { label: 'Starting…', dot: Dot.Amber },
  [AiState.Ready]: { label: 'Ready', dot: Dot.Green },
  [AiState.Busy]: { label: 'Working…', dot: Dot.Amber }
};

export const statusOf = (state: AiState): Status => STATUS[state];

export const placeholderOf = (label: string | null): string => (label ? `Ask ${label} about this element…` : 'Choose an agent first');

const LOGO_IDS: Record<string, AgentId> = { claude: AgentId.ClaudeCode, codex: AgentId.Codex, cursor: AgentId.Cursor, copilot: AgentId.Copilot, gemini: AgentId.Gemini };

export type AgentMark = { logo: AgentLogo | null; initial: string };

export function markOf(id: string, label: string): AgentMark {
  const logoId = LOGO_IDS[id];
  return { logo: logoId ? AGENT_LOGOS[logoId] : null, initial: label.charAt(0).toUpperCase() };
}

export const isThinking = (busy: boolean, items: Item[]): boolean => {
  const last = items.at(-1);
  return busy && (last === undefined || last.kind === ItemKind.User || last.kind === ItemKind.Thought || last.kind === ItemKind.Tool);
};

const POLICY_SHORT: Record<Policy, string> = { ask: 'Ask', edits: 'Edits', all: 'All' };

export const pickerLabel = (modes: ModeView[], mode: string | null, policy: Policy): string => {
  const agentMode = modes.find((m) => m.id === mode)?.name;
  return [agentMode, POLICY_SHORT[policy]].filter(Boolean).join(' · ');
};

export const isDanger = (policy: Policy): boolean => POLICY_ROWS.find((row) => row.id === policy)?.danger ?? false;

const AGO_UNITS: [number, string][] = [
  [7 * 86_400_000, 'w'],
  [86_400_000, 'd'],
  [3_600_000, 'h'],
  [60_000, 'm']
];

export const agoOf = (now: number, then: number): string => {
  const elapsed = now - then;
  const unit = AGO_UNITS.find(([size]) => elapsed >= size);
  return unit ? `${Math.floor(elapsed / unit[0])}${unit[1]}` : 'now';
};

export const pickerOf = (configs: ConfigView[], category: ConfigCategory): ConfigView | undefined => configs.find((c) => c.category === category);

export const valueName = (option: ConfigView): string => option.values.find((v) => v.id === option.current)?.name ?? option.current;
