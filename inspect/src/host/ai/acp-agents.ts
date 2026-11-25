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
  Qwen = 'qwen',
  Kiro = 'kiro',
  Pi = 'pi',
  Devin = 'devin',
  Augment = 'augment',
  Cline = 'cline',
  Kimi = 'kimi',
  Qoder = 'qoder',
  Droid = 'droid',
  Vibe = 'vibe'
}

export type AdapterSpec = { pkg: string; version: string };

type Entry = { label: string; launch: Launch | null; adapter: AdapterSpec | null; clues: Clue[]; install: string };

const binary = (value: string): Clue[] => [{ probe: Probe.Binary, value }];

const ENTRIES: Record<AcpId, Entry> = {
  [AcpId.Claude]: { label: 'Claude Code', launch: null, adapter: { pkg: '@agentclientprotocol/claude-agent-acp', version: '0.110.0' }, clues: AGENT_CLUES[AgentId.ClaudeCode], install: 'npm i -g @anthropic-ai/claude-code' },
  [AcpId.Codex]: { label: 'Codex', launch: null, adapter: { pkg: '@agentclientprotocol/codex-acp', version: '2.12.0' }, clues: AGENT_CLUES[AgentId.Codex], install: 'npm i -g @openai/codex' },
  [AcpId.OpenCode]: { label: 'OpenCode', launch: { command: 'opencode', args: ['acp'] }, adapter: null, clues: binary('opencode'), install: 'npm i -g opencode-ai' },
  [AcpId.Gemini]: { label: 'Gemini CLI', launch: { command: 'gemini', args: ['--acp'] }, adapter: null, clues: AGENT_CLUES[AgentId.Gemini], install: 'npm i -g @google/gemini-cli' },
  [AcpId.Grok]: { label: 'Grok Build', launch: { command: 'grok', args: ['agent', 'stdio'] }, adapter: null, clues: binary('grok'), install: 'npm i -g @xai-official/grok' },
  [AcpId.Cursor]: { label: 'Cursor Agent', launch: { command: 'cursor-agent', args: ['acp'] }, adapter: null, clues: binary('cursor-agent'), install: 'curl https://cursor.com/install -fsS | bash' },
  [AcpId.Copilot]: { label: 'GitHub Copilot', launch: { command: 'copilot', args: ['--acp'] }, adapter: null, clues: binary('copilot'), install: 'npm i -g @github/copilot' },
  [AcpId.Goose]: { label: 'Goose', launch: { command: 'goose', args: ['acp'] }, adapter: null, clues: binary('goose'), install: 'brew install block-goose-cli' },
  [AcpId.Qwen]: { label: 'Qwen Code', launch: { command: 'qwen', args: ['--acp'] }, adapter: null, clues: binary('qwen'), install: 'npm i -g @qwen-code/qwen-code' },
  [AcpId.Kiro]: { label: 'Kiro', launch: { command: 'kiro-cli', args: ['acp'] }, adapter: null, clues: binary('kiro-cli'), install: 'curl -fsSL https://cli.kiro.dev/install | bash' },
  [AcpId.Pi]: { label: 'Pi', launch: null, adapter: { pkg: 'pi-acp', version: '0.0.35' }, clues: binary('pi'), install: 'npm i -g @earendil-works/pi-coding-agent' },
  [AcpId.Devin]: { label: 'Devin', launch: { command: 'devin', args: ['acp'] }, adapter: null, clues: binary('devin'), install: 'https://docs.devin.ai/cli' },
  [AcpId.Augment]: { label: 'Augment', launch: { command: 'auggie', args: ['--acp'] }, adapter: null, clues: binary('auggie'), install: 'npm i -g @augmentcode/auggie' },
  [AcpId.Cline]: { label: 'Cline', launch: { command: 'cline', args: ['--acp'] }, adapter: null, clues: binary('cline'), install: 'npm i -g cline' },
  [AcpId.Kimi]: { label: 'Kimi CLI', launch: { command: 'kimi', args: ['acp'] }, adapter: null, clues: binary('kimi'), install: 'uv tool install kimi-cli' },
  [AcpId.Qoder]: { label: 'Qoder', launch: { command: 'qodercli', args: ['--acp'] }, adapter: null, clues: binary('qodercli'), install: 'npm i -g @qoder-ai/qodercli' },
  [AcpId.Droid]: { label: 'Factory Droid', launch: { command: 'droid', args: ['exec', '--output-format', 'acp'] }, adapter: null, clues: binary('droid'), install: 'curl -fsSL https://app.factory.ai/cli | sh' },
  [AcpId.Vibe]: { label: 'Mistral Vibe', launch: { command: 'vibe-acp', args: [] }, adapter: null, clues: binary('vibe-acp'), install: 'uv tool install mistral-vibe' }
};

export type AcpAgent = { id: AcpId; label: string; installed: boolean; install: string; adapter: boolean };

export const acpAgents = (env: AgentEnv): AcpAgent[] =>
  (Object.keys(ENTRIES) as AcpId[]).map((id) => ({ id, label: ENTRIES[id].label, installed: ENTRIES[id].clues.some((clue) => seen(env, clue)), install: ENTRIES[id].install, adapter: ENTRIES[id].adapter !== null }));

export const launchOf = (id: AcpId): Launch | null => ENTRIES[id].launch;

export const adapterOf = (id: AcpId): AdapterSpec | null => ENTRIES[id].adapter;

export const ADAPTED = (Object.keys(ENTRIES) as AcpId[]).filter((id) => ENTRIES[id].adapter !== null);
