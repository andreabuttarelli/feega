import { AgentId } from '../../messages';
import { AGENT_CLUES, Probe, seen, type AgentEnv, type Clue } from '../agents';
import type { Launch } from './agent-session';

export enum AcpId {
  Claude = 'claude',
  Codex = 'codex',
  OpenCode = 'opencode',
  Gemini = 'gemini',
  Grok = 'grok',
  Cursor = 'cursor',
  Copilot = 'copilot',
  Goose = 'goose',
  Qwen = 'qwen'
}

type Entry = { label: string; launch: Launch; clues: Clue[]; install: string; adapter: boolean };

const binary = (value: string): Clue[] => [{ probe: Probe.Binary, value }];

const npx = (pkg: string, ...args: string[]): Launch => ({ command: 'npx', args: ['-y', pkg, ...args] });

const ENTRIES: Record<AcpId, Entry> = {
  [AcpId.Claude]: { label: 'Claude Code', launch: npx('@agentclientprotocol/claude-agent-acp@0.110.0'), clues: AGENT_CLUES[AgentId.ClaudeCode], install: 'npm i -g @anthropic-ai/claude-code', adapter: true },
  [AcpId.Codex]: { label: 'Codex', launch: npx('@agentclientprotocol/codex-acp@2.12.0'), clues: AGENT_CLUES[AgentId.Codex], install: 'npm i -g @openai/codex', adapter: true },
  [AcpId.OpenCode]: { label: 'OpenCode', launch: { command: 'opencode', args: ['acp'] }, clues: binary('opencode'), install: 'npm i -g opencode-ai', adapter: false },
  [AcpId.Gemini]: { label: 'Gemini CLI', launch: { command: 'gemini', args: ['--acp'] }, clues: AGENT_CLUES[AgentId.Gemini], install: 'npm i -g @google/gemini-cli', adapter: false },
  [AcpId.Grok]: { label: 'Grok', launch: { command: 'grok', args: ['agent', 'stdio'] }, clues: binary('grok'), install: 'npm i -g @xai-official/grok', adapter: false },
  [AcpId.Cursor]: { label: 'Cursor Agent', launch: { command: 'cursor-agent', args: ['acp'] }, clues: binary('cursor-agent'), install: 'curl https://cursor.com/install -fsS | bash', adapter: false },
  [AcpId.Copilot]: { label: 'GitHub Copilot', launch: { command: 'copilot', args: ['--acp'] }, clues: binary('copilot'), install: 'npm i -g @github/copilot', adapter: false },
  [AcpId.Goose]: { label: 'Goose', launch: { command: 'goose', args: ['acp'] }, clues: binary('goose'), install: 'brew install block-goose-cli', adapter: false },
  [AcpId.Qwen]: { label: 'Qwen Code', launch: { command: 'qwen', args: ['--acp'] }, clues: binary('qwen'), install: 'npm i -g @qwen-code/qwen-code', adapter: false }
};

export type AcpAgent = { id: AcpId; label: string; installed: boolean; install: string; adapter: boolean };

export const acpAgents = (env: AgentEnv): AcpAgent[] =>
  (Object.keys(ENTRIES) as AcpId[]).map((id) => ({ id, label: ENTRIES[id].label, installed: ENTRIES[id].clues.some((clue) => seen(env, clue)), install: ENTRIES[id].install, adapter: ENTRIES[id].adapter }));

export const launchOf = (id: AcpId): Launch => ENTRIES[id].launch;
