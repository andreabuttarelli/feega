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

type Entry = { label: string; launch: Launch; clues: Clue[]; install: string; adapter: boolean };

const binary = (value: string): Clue[] => [{ probe: Probe.Binary, value }];

const npx = (pkg: string, ...args: string[]): Launch => ({ command: 'npx', args: ['-y', pkg, ...args] });

const ENTRIES: Record<AcpId, Entry> = {
  [AcpId.Claude]: { label: 'Claude Code', launch: npx('@agentclientprotocol/claude-agent-acp@0.110.0'), clues: AGENT_CLUES[AgentId.ClaudeCode], install: 'npm i -g @anthropic-ai/claude-code', adapter: true },
  [AcpId.Codex]: { label: 'Codex', launch: npx('@agentclientprotocol/codex-acp@2.12.0'), clues: AGENT_CLUES[AgentId.Codex], install: 'npm i -g @openai/codex', adapter: true },
  [AcpId.OpenCode]: { label: 'OpenCode', launch: { command: 'opencode', args: ['acp'] }, clues: binary('opencode'), install: 'npm i -g opencode-ai', adapter: false },
  [AcpId.Gemini]: { label: 'Gemini CLI', launch: { command: 'gemini', args: ['--acp'] }, clues: AGENT_CLUES[AgentId.Gemini], install: 'npm i -g @google/gemini-cli', adapter: false },
  [AcpId.Grok]: { label: 'Grok Build', launch: { command: 'grok', args: ['agent', 'stdio'] }, clues: binary('grok'), install: 'npm i -g @xai-official/grok', adapter: false },
  [AcpId.Cursor]: { label: 'Cursor Agent', launch: { command: 'cursor-agent', args: ['acp'] }, clues: binary('cursor-agent'), install: 'curl https://cursor.com/install -fsS | bash', adapter: false },
  [AcpId.Copilot]: { label: 'GitHub Copilot', launch: { command: 'copilot', args: ['--acp'] }, clues: binary('copilot'), install: 'npm i -g @github/copilot', adapter: false },
  [AcpId.Goose]: { label: 'Goose', launch: { command: 'goose', args: ['acp'] }, clues: binary('goose'), install: 'brew install block-goose-cli', adapter: false },
  [AcpId.Qwen]: { label: 'Qwen Code', launch: { command: 'qwen', args: ['--acp'] }, clues: binary('qwen'), install: 'npm i -g @qwen-code/qwen-code', adapter: false },
  [AcpId.Kiro]: { label: 'Kiro', launch: { command: 'kiro-cli', args: ['acp'] }, clues: binary('kiro-cli'), install: 'curl -fsSL https://cli.kiro.dev/install | bash', adapter: false },
  [AcpId.Pi]: { label: 'Pi', launch: npx('pi-acp@0.0.35'), clues: binary('pi'), install: 'npm i -g @earendil-works/pi-coding-agent', adapter: true },
  [AcpId.Devin]: { label: 'Devin', launch: { command: 'devin', args: ['acp'] }, clues: binary('devin'), install: 'https://docs.devin.ai/cli', adapter: false },
  [AcpId.Augment]: { label: 'Augment', launch: { command: 'auggie', args: ['--acp'] }, clues: binary('auggie'), install: 'npm i -g @augmentcode/auggie', adapter: false },
  [AcpId.Cline]: { label: 'Cline', launch: { command: 'cline', args: ['--acp'] }, clues: binary('cline'), install: 'npm i -g cline', adapter: false },
  [AcpId.Kimi]: { label: 'Kimi CLI', launch: { command: 'kimi', args: ['acp'] }, clues: binary('kimi'), install: 'uv tool install kimi-cli', adapter: false },
  [AcpId.Qoder]: { label: 'Qoder', launch: { command: 'qodercli', args: ['--acp'] }, clues: binary('qodercli'), install: 'npm i -g @qoder-ai/qodercli', adapter: false },
  [AcpId.Droid]: { label: 'Factory Droid', launch: { command: 'droid', args: ['exec', '--output-format', 'acp'] }, clues: binary('droid'), install: 'curl -fsSL https://app.factory.ai/cli | sh', adapter: false },
  [AcpId.Vibe]: { label: 'Mistral Vibe', launch: { command: 'vibe-acp', args: [] }, clues: binary('vibe-acp'), install: 'uv tool install mistral-vibe', adapter: false }
};

export type AcpAgent = { id: AcpId; label: string; installed: boolean; install: string; adapter: boolean };

export const acpAgents = (env: AgentEnv): AcpAgent[] =>
  (Object.keys(ENTRIES) as AcpId[]).map((id) => ({ id, label: ENTRIES[id].label, installed: ENTRIES[id].clues.some((clue) => seen(env, clue)), install: ENTRIES[id].install, adapter: ENTRIES[id].adapter }));

export const launchOf = (id: AcpId): Launch => ENTRIES[id].launch;
